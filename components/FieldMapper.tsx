"use client";

import { FieldMapping } from "@/lib/types";
import { useEffect, useState } from "react";

interface FieldMapperProps {
  csvHeaders: string[];
  onMappingChange: (mapping: FieldMapping) => void;
}

const REQUIRED_FIELDS = [
  { key: "BillNumber", label: "Bill Number", required: true },
  { key: "Location", label: "Location/Department", required: false },
  { key: "ProjectName", label: "Project Name", required: true },
  { key: "CustomerName", label: "Customer Name", required: true },
  { key: "VendorName", label: "Vendor Name", required: true },
  { key: "BillDate", label: "Bill Date", required: true },
  {
    key: "BillLineDescription",
    label: "Bill Line Description",
    required: true,
  },
  { key: "BillLineAmount", label: "Bill Line Amount", required: true },
  { key: "Currency", label: "Currency", required: false },
  { key: "InvoiceDate", label: "Invoice Date", required: true },
  { key: "PONumber", label: "PO Number", required: false },
  { key: "PointOfContact", label: "Point of Contact", required: false },
  {
    key: "AttachmentFiles",
    label: "Attachment Files (semicolon-separated)",
    required: false,
  },
];

export function FieldMapper({ csvHeaders, onMappingChange }: FieldMapperProps) {
  const [mapping, setMapping] = useState<FieldMapping>({} as FieldMapping);

  useEffect(() => {
    // Auto-map fields with exact matches and common variations
    const autoMapping: any = {};

    // Define mapping rules for common column name variations
    const mappingRules: Record<string, string[]> = {
      BillNumber: [
        "billnumber",
        "bill_number",
        "bill number",
        "bill_no",
        "billno",
        "bill no",
        "invoice_number",
        "invoicenumber",
        "docnumber",
        "doc_number",
      ],
      Location: [
        "location",
        "department",
        "dept",
        "location/department",
        "location_department",
      ],
      ProjectName: [
        "projectname",
        "project_name",
        "project name",
        "project_number",
        "project number",
        "project_number:customer",
      ],
      CustomerName: [
        "customername",
        "customer_name",
        "customer name",
        "customer",
      ],
      VendorName: ["vendorname", "vendor_name", "vendor name", "vendor"],
      BillDate: ["billdate", "bill_date", "bill date"],
      BillLineDescription: [
        "billlinedescription",
        "bill_line_description",
        "bill_description",
        "bill description",
        "description",
        "item_description_for invoice",
        "item description for invoice",
        "item_description",
        "item description",
      ],
      BillLineAmount: [
        "billlineamount",
        "bill_line_amount",
        "bill_amount",
        "bill amount",
        "line_amount",
        "amount",
      ],
      Currency: ["currency"],
      InvoiceDate: ["invoicedate", "invoice_date", "invoice date"],
      PONumber: ["ponumber", "po_number", "po number", "po"],
      PointOfContact: [
        "pointofcontact",
        "point_of_contact",
        "point of contact",
        "contact",
      ],
      AttachmentFiles: [
        "attachmentfiles",
        "attachment_files",
        "attachment files",
        "attachment_url",
        "attachments",
      ],
    };

    REQUIRED_FIELDS.forEach((field) => {
      const variations = mappingRules[field.key] || [];
      const match = csvHeaders.find((h) =>
        variations.includes(h.toLowerCase().trim())
      );
      if (match) {
        autoMapping[field.key] = match;
      }
    });

    console.log("Auto-mapped fields:", autoMapping);
    console.log("CSV Headers:", csvHeaders);

    setMapping(autoMapping);
    onMappingChange(autoMapping);
  }, [csvHeaders, onMappingChange]);

  const handleMappingChange = (fieldKey: string, csvColumn: string) => {
    const newMapping = { ...mapping, [fieldKey]: csvColumn };
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Map CSV Columns to Fields</h3>
        <p className="text-sm text-gray-600 mt-1">
          Fields are automatically mapped based on column names. Adjust if
          needed.
        </p>
      </div>

      <div className="grid gap-4">
        {REQUIRED_FIELDS.map((field) => (
          <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
            <label className="text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={mapping[field.key as keyof FieldMapping] || ""}
              onChange={(e) => handleMappingChange(field.key, e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Column --</option>
              {csvHeaders.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Make sure all required fields (marked with *)
          are mapped before proceeding.
        </p>
      </div>
    </div>
  );
}
