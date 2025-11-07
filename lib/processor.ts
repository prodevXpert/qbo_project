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
      !row.BillNumber?.trim() &&
      !row.ProjectName?.trim() &&
      !row.CustomerName?.trim() &&
      !row.VendorName?.trim() &&
      !row.BillDate?.trim() &&
      !row.BillLineDescription?.trim() &&
      !row.BillLineAmount?.trim() &&
      !row.Category?.trim() &&
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
    if (!row.BillNumber?.trim()) {
      errors.push({
        row: rowIndex,
        field: "BillNumber",
        message: "Bill number is required",
      });
    }
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

    // Group rows by BillNumber
    const billGroups = new Map<string, { rows: CSVRow[]; indices: number[] }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (this.isEmptyRow(row)) {
        continue;
      }

      const billNumber = row.BillNumber?.trim();
      if (!billNumber) {
        results.push({
          rowIndex: i,
          actions: [],
          warnings: [],
          errors: ["BillNumber is required"],
        });
        continue;
      }

      if (!billGroups.has(billNumber)) {
        billGroups.set(billNumber, { rows: [], indices: [] });
      }
      billGroups.get(billNumber)!.rows.push(row);
      billGroups.get(billNumber)!.indices.push(i);
    }

    // Process each bill group for dry run
    for (const [billNumber, group] of billGroups.entries()) {
      const firstRow = group.rows[0];
      const actions: string[] = [];
      const warnings: string[] = [];
      const allErrors: string[] = [];

      // Validate all rows in the group
      for (let i = 0; i < group.rows.length; i++) {
        const errors = this.validateRow(group.rows[i], group.indices[i]);
        if (errors.length > 0) {
          allErrors.push(
            ...errors.map(
              (e) => `Row ${group.indices[i] + 1}: ${e.field}: ${e.message}`
            )
          );
        }
      }

      if (allErrors.length > 0) {
        // Add error result for each row in the group
        for (const idx of group.indices) {
          results.push({
            rowIndex: idx,
            actions: [],
            warnings: [],
            errors: allErrors,
          });
        }
        continue;
      }

      // Simulate actions for the bill
      actions.push(
        `Create Bill #${billNumber} with ${group.rows.length} line item(s)`
      );
      actions.push(`Find or create Customer: "${firstRow.CustomerName}"`);
      actions.push(`Find or create Vendor: "${firstRow.VendorName}"`);

      if (firstRow.Location?.trim()) {
        actions.push(`Find Department/Location: "${firstRow.Location}"`);
      }

      // Add actions for each line item
      for (let i = 0; i < group.rows.length; i++) {
        const row = group.rows[i];
        actions.push(
          `  Line ${i + 1}: Project "${row.ProjectName}" - ${
            row.BillLineAmount
          } ${row.Currency || this.settings.defaultCurrency} - ${
            row.BillLineDescription
          }`
        );
      }

      // Collect all unique attachments
      const allAttachments = new Set<string>();
      for (const row of group.rows) {
        const attachments =
          row.AttachmentFiles?.split(";").filter((f) => f.trim()) || [];
        attachments.forEach((f) => allAttachments.add(f.trim()));
      }

      if (allAttachments.size > 0) {
        actions.push(
          `Attach ${allAttachments.size} file(s) to Bill: ${Array.from(
            allAttachments
          ).join(", ")}`
        );
        if (this.settings.alsoAttachToInvoice) {
          actions.push(`Also attach files to Invoice`);
        }
      }

      actions.push(`Create Invoice from billable expenses`);
      if (firstRow.PONumber?.trim()) {
        actions.push(`Set PO Number: ${firstRow.PONumber}`);
      }
      if (firstRow.PointOfContact?.trim()) {
        actions.push(`Set Point of Contact: "${firstRow.PointOfContact}"`);
      }

      // Add the same result for each row in the group
      for (const idx of group.indices) {
        results.push({
          rowIndex: idx,
          actions,
          warnings,
          errors: [],
        });
      }
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

      // Step 4: Find Category/Class if specified
      let classId: string | undefined;
      if (row.Category?.trim()) {
        const classObj = await this.qboService.findClassByName(
          row.Category.trim()
        );
        if (classObj) {
          classId = classObj.Id;
        }
        // If class not found, we'll just skip it (optional field)
      }

      // Step 5: Create Bill
      const amount = validateAmount(row.BillLineAmount)!;
      const billDate = parseDate(
        row.BillDate,
        this.settings.strictDateParsing
      )!;
      const expenseAccountId = await this.qboService.getExpenseAccount();

      const lineDetail: any = {
        AccountRef: { value: expenseAccountId },
        CustomerRef: { value: subCustomer.Id! },
        BillableStatus: "Billable",
      };

      if (classId) {
        lineDetail.ClassRef = { value: classId };
      }

      const bill = await this.qboService.createBill({
        VendorRef: { value: vendor.Id! },
        TxnDate: billDate.toISOString().split("T")[0],
        Line: [
          {
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: amount,
            Description: row.BillLineDescription,
            AccountBasedExpenseLineDetail: lineDetail,
          },
        ],
        CurrencyRef: row.Currency ? { value: row.Currency } : undefined,
      });

      // Step 6: Attach files to Bill
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

    // Group rows by BillNumber
    const billGroups = new Map<string, { rows: CSVRow[]; indices: number[] }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (this.isEmptyRow(row)) {
        results.push({
          rowIndex: i,
          status: "skipped",
          message: "Empty row",
        });
        continue;
      }

      const billNumber = row.BillNumber?.trim();
      if (!billNumber) {
        results.push({
          rowIndex: i,
          status: "error",
          error: "BillNumber is required",
        });
        continue;
      }

      if (!billGroups.has(billNumber)) {
        billGroups.set(billNumber, { rows: [], indices: [] });
      }
      billGroups.get(billNumber)!.rows.push(row);
      billGroups.get(billNumber)!.indices.push(i);
    }

    // Process each bill group
    let processedCount = 0;
    for (const [billNumber, group] of billGroups.entries()) {
      const billResult = await this.processBillGroup(
        billNumber,
        group.rows,
        group.indices,
        attachments
      );

      // Add results for each row in the group
      for (let i = 0; i < group.indices.length; i++) {
        results.push({
          ...billResult,
          rowIndex: group.indices[i],
        });
      }

      processedCount += group.rows.length;
      if (onProgress) {
        onProgress(processedCount, rows.length);
      }
    }

    return results;
  }

  private async processBillGroup(
    billNumber: string,
    rows: CSVRow[],
    indices: number[],
    attachments: Map<string, UploadedFile>
  ): Promise<Omit<ProcessingResult, "rowIndex">> {
    try {
      // Use the first row for bill-level information
      const firstRow = rows[0];
      const firstIndex = indices[0];

      // Validate all rows in the group
      for (let i = 0; i < rows.length; i++) {
        const errors = this.validateRow(rows[i], indices[i]);
        if (errors.length > 0) {
          return {
            status: "error",
            error: `Row ${indices[i] + 1}: ${errors
              .map((e) => `${e.field}: ${e.message}`)
              .join("; ")}`,
          };
        }
      }

      // Check idempotency for the bill
      const idempotencyKey = `bill_${billNumber}`;
      if (this.processedKeys.has(idempotencyKey)) {
        return {
          status: "skipped",
          message: `Bill ${billNumber} already processed`,
          idempotencyKey,
        };
      }

      // Step 1: Upsert Customer (from first row)
      let customer = await this.qboService.findCustomerByName(
        firstRow.CustomerName
      );
      if (!customer) {
        if (this.settings.autoCreate) {
          customer = await this.qboService.createCustomer(
            firstRow.CustomerName
          );
        } else {
          return {
            status: "needs_review",
            error: `Customer "${firstRow.CustomerName}" not found. Enable auto-create or create manually.`,
          };
        }
      }

      // Step 2: Upsert Vendor (from first row)
      let vendor = await this.qboService.findVendorByName(firstRow.VendorName);
      if (!vendor) {
        if (this.settings.autoCreate) {
          vendor = await this.qboService.createVendor(firstRow.VendorName);
        } else {
          return {
            status: "needs_review",
            error: `Vendor "${firstRow.VendorName}" not found. Enable auto-create or create manually.`,
          };
        }
      }

      // Step 3: Find Department/Location if specified
      let departmentId: string | undefined;
      if (firstRow.Location?.trim()) {
        const department = await this.qboService.findDepartmentByName(
          firstRow.Location.trim()
        );
        if (department) {
          departmentId = department.Id;
        }
        // If department not found, we'll just skip it (optional field)
      }

      // Step 4: Create line items for each row
      const expenseAccountId = await this.qboService.getExpenseAccount();
      const billLines: any[] = [];
      const allSubCustomerIds: string[] = [];

      for (const row of rows) {
        // Upsert Sub-Customer (Project) for each line
        let subCustomer = await this.qboService.findCustomerByName(
          row.ProjectName
        );
        if (!subCustomer) {
          subCustomer = await this.qboService.createCustomer(
            row.ProjectName,
            customer.Id
          );
        }
        allSubCustomerIds.push(subCustomer.Id!);

        // Find Category/Class if specified
        let classId: string | undefined;
        if (row.Category?.trim()) {
          const classObj = await this.qboService.findClassByName(
            row.Category.trim()
          );
          if (classObj) {
            classId = classObj.Id;
          }
        }

        const amount = validateAmount(row.BillLineAmount)!;
        const lineDetail: any = {
          AccountRef: { value: expenseAccountId },
          CustomerRef: { value: subCustomer.Id! },
          BillableStatus: "Billable",
        };

        if (classId) {
          lineDetail.ClassRef = { value: classId };
        }

        billLines.push({
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: amount,
          Description: row.BillLineDescription,
          AccountBasedExpenseLineDetail: lineDetail,
        });
      }

      // Step 5: Create Bill with all line items
      const billDate = parseDate(
        firstRow.BillDate,
        this.settings.strictDateParsing
      )!;
      const billData: any = {
        DocNumber: billNumber,
        VendorRef: { value: vendor.Id! },
        TxnDate: billDate.toISOString().split("T")[0],
        Line: billLines,
        CurrencyRef: firstRow.Currency
          ? { value: firstRow.Currency }
          : undefined,
      };

      if (departmentId) {
        billData.DepartmentRef = { value: departmentId };
      }

      const bill = await this.qboService.createBill(billData);

      // Step 6: Attach files to Bill (collect all unique files from all rows)
      const attachmentResults: AttachmentResult[] = [];
      const allFileNames = new Set<string>();

      for (const row of rows) {
        const fileNames =
          row.AttachmentFiles?.split(";").filter((f) => f.trim()) || [];
        fileNames.forEach((f) => allFileNames.add(f.trim()));
      }

      for (const fileName of allFileNames) {
        const file = attachments.get(fileName);
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

      // Step 7: Create Invoice from billable expenses (using first row's invoice date)
      const invoiceDate = parseDate(
        firstRow.InvoiceDate,
        this.settings.strictDateParsing
      )!;

      // Create invoice for the first sub-customer (or we could create multiple invoices)
      const invoice = await this.qboService.createInvoiceFromBillableExpenses(
        allSubCustomerIds[0],
        invoiceDate.toISOString().split("T")[0],
        firstRow.PONumber,
        firstRow.PointOfContact,
        firstRow.Currency || this.settings.defaultCurrency
      );

      // Step 8: Optionally attach files to Invoice
      if (this.settings.alsoAttachToInvoice) {
        for (const fileName of allFileNames) {
          const file = attachments.get(fileName);
          if (file) {
            try {
              await this.qboService.uploadAttachment(
                file,
                "Invoice",
                invoice.Id
              );
            } catch (error) {
              console.error(`Failed to attach ${fileName} to invoice:`, error);
            }
          }
        }
      }

      // Mark as processed
      this.processedKeys.add(idempotencyKey);

      return {
        status: "success",
        customerId: customer.Id,
        subCustomerId: allSubCustomerIds[0],
        vendorId: vendor.Id,
        billId: bill.Id,
        invoiceId: invoice.Id,
        attachmentResults,
        idempotencyKey,
        message: `Bill ${billNumber} created with ${billLines.length} line items`,
      };
    } catch (error: any) {
      console.error(`Error processing bill ${billNumber}:`, error);

      // Extract meaningful error message
      let errorMessage = "Unknown error occurred";
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error.fault?.error?.[0]) {
        errorMessage =
          error.fault.error[0].message || error.fault.error[0].detail;
      } else if (error.toString && error.toString() !== "[object Object]") {
        errorMessage = error.toString();
      } else {
        errorMessage = JSON.stringify(error);
      }

      return {
        status: "error",
        error: errorMessage,
      };
    }
  }
}
