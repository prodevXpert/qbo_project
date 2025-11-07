declare module "node-quickbooks" {
  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      tokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: number | null,
      oauthVersion: string,
      refreshToken: string
    );

    findCustomers(
      criteria: Array<{ field: string; value: string; operator: string }>,
      callback: (err: any, customers: any) => void
    ): void;

    createCustomer(
      customer: any,
      callback: (err: any, result: any) => void
    ): void;

    findVendors(
      criteria: Array<{ field: string; value: string; operator: string }>,
      callback: (err: any, vendors: any) => void
    ): void;

    createVendor(vendor: any, callback: (err: any, result: any) => void): void;

    createBill(bill: any, callback: (err: any, result: any) => void): void;

    createInvoice(
      invoice: any,
      callback: (err: any, result: any) => void
    ): void;

    createAttachable(
      attachable: any,
      file: any,
      callback: (err: any, result: any) => void
    ): void;

    findAccounts(
      criteria: Array<{ field: string; value: string; operator: string }>,
      callback: (err: any, accounts: any) => void
    ): void;

    findDepartments(
      criteria: Array<{ field: string; value: string; operator: string }>,
      callback: (err: any, departments: any) => void
    ): void;

    findClasses(
      criteria: Array<{ field: string; value: string; operator: string }>,
      callback: (err: any, classes: any) => void
    ): void;

    reportBillableExpenseDetail(
      options: any,
      callback: (err: any, result: any) => void
    ): void;
  }

  export = QuickBooks;
}
