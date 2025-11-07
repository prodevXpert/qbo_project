export interface CSVRow {
  BillNumber: string;
  Location: string;
  ProjectName: string;
  CustomerName: string;
  VendorName: string;
  BillDate: string;
  BillLineDescription: string;
  BillLineAmount: string;
  Currency: string;
  InvoiceDate: string;
  PONumber: string;
  PointOfContact: string;
  AttachmentFiles: string; // semicolon-separated filenames
}

export interface FieldMapping {
  BillNumber: string;
  Location: string;
  ProjectName: string;
  CustomerName: string;
  VendorName: string;
  BillDate: string;
  BillLineDescription: string;
  BillLineAmount: string;
  Currency: string;
  InvoiceDate: string;
  PONumber: string;
  PointOfContact: string;
  AttachmentFiles: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ProcessingSettings {
  autoCreate: boolean;
  alsoAttachToInvoice: boolean;
  fromBillableExpenses: boolean;
  defaultCurrency: string;
  strictDateParsing: boolean;
  environment: "sandbox" | "production";
}

export interface ProcessingResult {
  rowIndex: number;
  status: "success" | "error" | "needs_review" | "skipped";
  customerId?: string;
  subCustomerId?: string;
  vendorId?: string;
  billId?: string;
  invoiceId?: string;
  attachmentResults?: AttachmentResult[];
  error?: string;
  message?: string;
  idempotencyKey?: string;
}

export interface AttachmentResult {
  filename: string;
  attachableId?: string;
  status: "success" | "error";
  error?: string;
}

export interface DryRunResult {
  rowIndex: number;
  actions: string[];
  warnings: string[];
  errors: string[];
}

export interface QBOTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  realm_id: string;
  environment: "sandbox" | "production";
}

export interface QBOCustomer {
  Id?: string;
  DisplayName: string;
  ParentRef?: {
    value: string;
  };
}

export interface QBOVendor {
  Id?: string;
  DisplayName: string;
}

export interface QBOBill {
  Id?: string;
  DocNumber?: string;
  VendorRef: {
    value: string;
  };
  DepartmentRef?: {
    value: string;
    name?: string;
  };
  Line: Array<{
    DetailType: "AccountBasedExpenseLineDetail";
    Amount: number;
    Description?: string;
    AccountBasedExpenseLineDetail: {
      AccountRef: {
        value: string;
      };
      CustomerRef?: {
        value: string;
      };
      BillableStatus?: "Billable" | "NotBillable" | "HasBeenBilled";
    };
  }>;
  TxnDate: string;
  CurrencyRef?: {
    value: string;
  };
}

export interface QBOInvoice {
  Id?: string;
  CustomerRef: {
    value: string;
  };
  Line: Array<any>;
  TxnDate: string;
  CustomField?: Array<{
    DefinitionId: string;
    Name: string;
    Type: string;
    StringValue?: string;
  }>;
  PONumber?: string;
  CurrencyRef?: {
    value: string;
  };
}

export interface QBOAttachable {
  Id?: string;
  FileName: string;
  AttachableRef: Array<{
    EntityRef: {
      type: string;
      value: string;
    };
  }>;
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
}
