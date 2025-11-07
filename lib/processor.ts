import { QBOService } from "./qbo-service";
import {
  AttachmentResult,
  CSVRow,
  DryRunResult,
  ProcessingResult,
  ProcessingSettings,
  QBOTokens,
  UploadedFile,
  ValidationError,
} from "./types";
import { generateIdempotencyKey, parseDate, validateAmount } from "./utils";

export class CSVProcessor {
  private qboService: QBOService;
  private settings: ProcessingSettings;
  private processedKeys: Set<string> = new Set();

  constructor(tokens: QBOTokens, settings: ProcessingSettings) {
    this.qboService = new QBOService(tokens);
    this.settings = settings;
  }

  // Check if a row is empty (all fields are empty or whitespace)
  private isEmptyRow(row: CSVRow): boolean {
    return (
      !row.ProjectName?.trim() &&
      !row.CustomerName?.trim() &&
      !row.VendorName?.trim() &&
      !row.BillDate?.trim() &&
      !row.BillLineDescription?.trim() &&
      !row.BillLineAmount?.trim() &&
      !row.InvoiceDate?.trim() &&
      !row.PONumber?.trim() &&
      !row.PointOfContact?.trim()
    );
  }

  validateRow(row: CSVRow, rowIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Skip empty rows
    if (this.isEmptyRow(row)) {
      return errors;
    }

    // Required fields
    if (!row.ProjectName?.trim()) {
      errors.push({
        row: rowIndex,
        field: "ProjectName",
        message: "Project name is required",
      });
    }
    if (!row.CustomerName?.trim()) {
      errors.push({
        row: rowIndex,
        field: "CustomerName",
        message: "Customer name is required",
      });
    }
    if (!row.VendorName?.trim()) {
      errors.push({
        row: rowIndex,
        field: "VendorName",
        message: "Vendor name is required",
      });
    }

    // Date validation
    const billDate = parseDate(row.BillDate, this.settings.strictDateParsing);
    if (!billDate) {
      errors.push({
        row: rowIndex,
        field: "BillDate",
        message: "Invalid bill date format",
      });
    }

    const invoiceDate = parseDate(
      row.InvoiceDate,
      this.settings.strictDateParsing
    );
    if (!invoiceDate) {
      errors.push({
        row: rowIndex,
        field: "InvoiceDate",
        message: "Invalid invoice date format",
      });
    }

    // Amount validation
    const amount = validateAmount(row.BillLineAmount);
    if (amount === null) {
      errors.push({
        row: rowIndex,
        field: "BillLineAmount",
        message: "Invalid amount format",
      });
    }

    // Currency validation
    const currency = row.Currency?.trim() || this.settings.defaultCurrency;
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push({
        row: rowIndex,
        field: "Currency",
        message: "Invalid currency code (must be 3-letter ISO code)",
      });
    }

    return errors;
  }

  async dryRun(rows: CSVRow[]): Promise<DryRunResult[]> {
    const results: DryRunResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (this.isEmptyRow(row)) {
        continue;
      }

      const actions: string[] = [];
      const warnings: string[] = [];
      const errors = this.validateRow(row, i);

      if (errors.length > 0) {
        results.push({
          rowIndex: i,
          actions: [],
          warnings: [],
          errors: errors.map((e) => `${e.field}: ${e.message}`),
        });
        continue;
      }

      // Simulate actions
      actions.push(`Find or create Customer: "${row.CustomerName}"`);
      actions.push(
        `Find or create Sub-Customer (Project): "${row.ProjectName}" under "${row.CustomerName}"`
      );
      actions.push(`Find or create Vendor: "${row.VendorName}"`);
      actions.push(
        `Create Bill for ${row.BillLineAmount} ${
          row.Currency || this.settings.defaultCurrency
        }`
      );

      const attachments =
        row.AttachmentFiles?.split(";").filter((f) => f.trim()) || [];
      if (attachments.length > 0) {
        actions.push(
          `Attach ${attachments.length} file(s) to Bill: ${attachments.join(
            ", "
          )}`
        );
        if (this.settings.alsoAttachToInvoice) {
          actions.push(`Also attach files to Invoice`);
        }
      }

      actions.push(`Create Invoice from billable expenses`);
      if (row.PONumber?.trim()) {
        actions.push(`Set PO Number: ${row.PONumber}`);
      }
      if (row.PointOfContact?.trim()) {
        actions.push(`Set Point of Contact: "${row.PointOfContact}"`);
      }

      results.push({
        rowIndex: i,
        actions,
        warnings,
        errors: [],
      });
    }

    return results;
  }

  async processRow(
    row: CSVRow,
    rowIndex: number,
    attachments: Map<string, UploadedFile>
  ): Promise<ProcessingResult> {
    try {
      // Skip empty rows
      if (this.isEmptyRow(row)) {
        return {
          rowIndex,
          status: "skipped",
          message: "Empty row",
        };
      }

      // Check idempotency
      const idempotencyKey = generateIdempotencyKey(row, rowIndex);
      if (this.processedKeys.has(idempotencyKey)) {
        return {
          rowIndex,
          status: "skipped",
          idempotencyKey,
        };
      }

      // Validate
      const errors = this.validateRow(row, rowIndex);
      if (errors.length > 0) {
        return {
          rowIndex,
          status: "error",
          error: errors.map((e) => `${e.field}: ${e.message}`).join("; "),
        };
      }

      // Step 1: Upsert Customer
      let customer = await this.qboService.findCustomerByName(row.CustomerName);
      if (!customer) {
        if (this.settings.autoCreate) {
          customer = await this.qboService.createCustomer(row.CustomerName);
        } else {
          return {
            rowIndex,
            status: "needs_review",
            error: `Customer "${row.CustomerName}" not found. Enable auto-create or create manually.`,
          };
        }
      }

      // Step 2: Upsert Sub-Customer (Project)
      let subCustomer = await this.qboService.findCustomerByName(
        row.ProjectName
      );
      if (!subCustomer) {
        subCustomer = await this.qboService.createCustomer(
          row.ProjectName,
          customer.Id
        );
      }

      // Step 3: Upsert Vendor
      let vendor = await this.qboService.findVendorByName(row.VendorName);
      if (!vendor) {
        if (this.settings.autoCreate) {
          vendor = await this.qboService.createVendor(row.VendorName);
        } else {
          return {
            rowIndex,
            status: "needs_review",
            error: `Vendor "${row.VendorName}" not found. Enable auto-create or create manually.`,
          };
        }
      }

      // Step 4: Create Bill
      const amount = validateAmount(row.BillLineAmount)!;
      const billDate = parseDate(
        row.BillDate,
        this.settings.strictDateParsing
      )!;
      const expenseAccountId = await this.qboService.getExpenseAccount();

      const bill = await this.qboService.createBill({
        VendorRef: { value: vendor.Id! },
        TxnDate: billDate.toISOString().split("T")[0],
        Line: [
          {
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: amount,
            Description: row.BillLineDescription,
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: expenseAccountId },
              CustomerRef: { value: subCustomer.Id! },
              BillableStatus: "Billable",
            },
          },
        ],
        CurrencyRef: row.Currency ? { value: row.Currency } : undefined,
      });

      // Step 5: Attach files to Bill
      const attachmentResults: AttachmentResult[] = [];
      const fileNames =
        row.AttachmentFiles?.split(";").filter((f) => f.trim()) || [];

      for (const fileName of fileNames) {
        const file = attachments.get(fileName.trim());
        if (file) {
          try {
            const attachable = await this.qboService.uploadAttachment(
              file,
              "Bill",
              bill.Id
            );
            attachmentResults.push({
              filename: fileName,
              attachableId: attachable.Id,
              status: "success",
            });
          } catch (error: any) {
            attachmentResults.push({
              filename: fileName,
              status: "error",
              error: error.message,
            });
          }
        } else {
          attachmentResults.push({
            filename: fileName,
            status: "error",
            error: "File not found in uploads",
          });
        }
      }

      // Step 6: Create Invoice from billable expenses
      const invoiceDate = parseDate(
        row.InvoiceDate,
        this.settings.strictDateParsing
      )!;
      const invoice = await this.qboService.createInvoiceFromBillableExpenses(
        subCustomer.Id!,
        invoiceDate.toISOString().split("T")[0],
        row.PONumber,
        row.PointOfContact,
        row.Currency || this.settings.defaultCurrency
      );

      // Step 7: Optionally attach files to Invoice
      if (this.settings.alsoAttachToInvoice) {
        for (const fileName of fileNames) {
          const file = attachments.get(fileName.trim());
          if (file) {
            try {
              await this.qboService.uploadAttachment(
                file,
                "Invoice",
                invoice.Id
              );
            } catch (error) {
              // Log but don't fail the whole process
              console.error(`Failed to attach ${fileName} to invoice:`, error);
            }
          }
        }
      }

      // Mark as processed
      this.processedKeys.add(idempotencyKey);

      return {
        rowIndex,
        status: "success",
        customerId: customer.Id,
        subCustomerId: subCustomer.Id,
        vendorId: vendor.Id,
        billId: bill.Id,
        invoiceId: invoice.Id,
        attachmentResults,
        idempotencyKey,
      };
    } catch (error: any) {
      console.error(`Error processing row ${rowIndex}:`, error);
      console.error("Row data:", row);

      // Extract meaningful error message
      let errorMessage = "Unknown error occurred";
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error.fault?.error?.[0]) {
        // QuickBooks API error format
        errorMessage =
          error.fault.error[0].message || error.fault.error[0].detail;
      } else if (error.toString && error.toString() !== "[object Object]") {
        errorMessage = error.toString();
      } else {
        errorMessage = JSON.stringify(error);
      }

      return {
        rowIndex,
        status: "error",
        error: errorMessage,
      };
    }
  }

  async processAll(
    rows: CSVRow[],
    attachments: Map<string, UploadedFile>,
    onProgress?: (current: number, total: number) => void
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = await this.processRow(rows[i], i, attachments);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, rows.length);
      }
    }

    return results;
  }
}
