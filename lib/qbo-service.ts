import QuickBooks from "node-quickbooks";
import {
  QBOAttachable,
  QBOBill,
  QBOCustomer,
  QBOInvoice,
  QBOTokens,
  QBOVendor,
  UploadedFile,
} from "./types";
import { sleep } from "./utils";

export class QBOService {
  private qbo: any;
  private maxRetries = 3;
  private baseDelay = 1000;

  constructor(tokens: QBOTokens) {
    const useSandbox = tokens.environment === "sandbox";

    this.qbo = new QuickBooks(
      process.env.QBO_CLIENT_ID!,
      process.env.QBO_CLIENT_SECRET!,
      tokens.access_token,
      false, // no token secret for OAuth2
      tokens.realm_id,
      useSandbox,
      true, // debug
      null, // minor version
      "2.0", // oauth version
      tokens.refresh_token
    );
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a rate limit error
      if (
        error.fault?.error?.[0]?.code === "3200" &&
        retryCount < this.maxRetries
      ) {
        const delay = this.baseDelay * Math.pow(2, retryCount);
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        return this.retryWithBackoff(operation, retryCount + 1);
      }
      throw error;
    }
  }

  async findCustomerByName(displayName: string): Promise<QBOCustomer | null> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.findCustomers(
          [{ field: "DisplayName", value: displayName, operator: "=" }],
          (err: any, customers: any) => {
            if (err) {
              if (err.fault?.error?.[0]?.code === "500") {
                resolve(null); // Not found
              } else {
                reject(err);
              }
            } else {
              resolve(customers?.QueryResponse?.Customer?.[0] || null);
            }
          }
        );
      });
    });
  }

  async createCustomer(
    displayName: string,
    parentRef?: string
  ): Promise<QBOCustomer> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        const customer: any = { DisplayName: displayName };

        // If parentRef is provided, this is a sub-customer (project/job)
        if (parentRef) {
          customer.ParentRef = { value: parentRef };
          customer.Job = true;
        } else {
          customer.Job = false;
        }

        this.qbo.createCustomer(customer, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    });
  }

  async findVendorByName(displayName: string): Promise<QBOVendor | null> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.findVendors(
          [{ field: "DisplayName", value: displayName, operator: "=" }],
          (err: any, vendors: any) => {
            if (err) {
              if (err.fault?.error?.[0]?.code === "500") {
                resolve(null);
              } else {
                reject(err);
              }
            } else {
              resolve(vendors?.QueryResponse?.Vendor?.[0] || null);
            }
          }
        );
      });
    });
  }

  async createVendor(displayName: string): Promise<QBOVendor> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.createVendor(
          { DisplayName: displayName },
          (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });
    });
  }

  async createBill(bill: QBOBill): Promise<any> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.createBill(bill, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    });
  }

  async getBillableExpenses(customerId: string): Promise<any[]> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        const query = `SELECT * FROM Bill WHERE Line.LinkedTxn.TxnId = '${customerId}'`;
        this.qbo.reportBillableExpenseDetail(
          { customer: customerId },
          (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result?.Rows?.Row || []);
          }
        );
      });
    });
  }

  async createInvoice(invoice: QBOInvoice): Promise<any> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.createInvoice(invoice, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    });
  }

  async uploadAttachment(
    file: UploadedFile,
    entityType: "Bill" | "Invoice",
    entityId: string
  ): Promise<QBOAttachable> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        const attachable = {
          FileName: file.name,
          AttachableRef: [
            {
              EntityRef: {
                type: entityType,
                value: entityId,
              },
            },
          ],
        };

        this.qbo.createAttachable(
          attachable,
          file.data,
          (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });
    });
  }

  async getExpenseAccount(): Promise<string> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.findAccounts(
          [{ field: "AccountType", value: "Expense", operator: "=" }],
          (err: any, accounts: any) => {
            if (err) reject(err);
            else {
              const account = accounts?.QueryResponse?.Account?.[0];
              resolve(account?.Id || "1"); // Default to account 1 if not found
            }
          }
        );
      });
    });
  }

  async findDepartmentByName(
    name: string
  ): Promise<{ Id: string; Name: string } | null> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.findDepartments(
          [{ field: "Name", value: name, operator: "=" }],
          (err: any, departments: any) => {
            if (err) {
              if (err.fault?.error?.[0]?.code === "500") {
                resolve(null); // Not found
              } else {
                reject(err);
              }
            } else {
              resolve(departments?.QueryResponse?.Department?.[0] || null);
            }
          }
        );
      });
    });
  }

  async findClassByName(
    name: string
  ): Promise<{ Id: string; Name: string } | null> {
    return this.retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        this.qbo.findClasses(
          [{ field: "Name", value: name, operator: "=" }],
          (err: any, classes: any) => {
            if (err) {
              if (err.fault?.error?.[0]?.code === "500") {
                resolve(null); // Not found
              } else {
                reject(err);
              }
            } else {
              resolve(classes?.QueryResponse?.Class?.[0] || null);
            }
          }
        );
      });
    });
  }

  async getOrCreateCustomField(fieldName: string): Promise<string> {
    // QuickBooks custom fields need to be created in the UI first
    // This method returns a placeholder - in production, you'd query existing custom fields
    return "1"; // Placeholder - actual implementation would query custom field definitions
  }

  async createInvoiceFromBillableExpenses(
    customerId: string,
    invoiceDate: string,
    poNumber?: string,
    pointOfContact?: string,
    currency?: string
  ): Promise<any> {
    return this.retryWithBackoff(async () => {
      return new Promise(async (resolve, reject) => {
        try {
          const invoice: QBOInvoice = {
            CustomerRef: { value: customerId },
            TxnDate: invoiceDate,
            Line: [
              {
                DetailType: "SalesItemLineDetail",
                Amount: 0,
                SalesItemLineDetail: {
                  ItemRef: { value: "1" }, // Services item
                },
              },
            ],
          };

          // Add PONumber if provided
          if (poNumber?.trim()) {
            invoice.PONumber = poNumber;
          }

          // Add Point of Contact custom field if provided
          if (pointOfContact?.trim()) {
            const customFieldId = await this.getOrCreateCustomField(
              "Point of Contact"
            );
            invoice.CustomField = [
              {
                DefinitionId: customFieldId,
                Name: "Point of Contact",
                Type: "StringType",
                StringValue: pointOfContact,
              },
            ];
          }

          if (currency) {
            invoice.CurrencyRef = { value: currency };
          }

          this.qbo.createInvoice(invoice, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}
