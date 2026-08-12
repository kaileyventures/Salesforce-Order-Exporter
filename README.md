# Salesforce Order Exporter

A premium, production-grade Chrome Extension designed to seamlessly export, update, and manage orders directly from Salesforce CRM without requiring manual SOQL execution or Data Loader.

![App Icon](icon.png)

---

## 🌟 Overview

**Salesforce Order Exporter** provides a sleek, glassmorphism sidebar UI directly inside Google Chrome. It leverages your active Salesforce login session to dynamically construct and execute SOQL queries against the Salesforce REST API, exporting formatted **`.xlsx` (Excel)** files with auto-filters, yellow headers, center alignment, and human-readable date formats.

This tool completely bypasses the need for Salesforce Inspector or Data Loader when exporting orders or performing bulk status and courier updates for shipping integrations (BlueDart, Delhivery, Expressbees, etc.).

---

## 🚀 Core Features

- **Direct `.xlsx` Excel Export:** Downloads native `.xlsx` files directly to your default browser download folder without annoying file-picker dialogs (`saveAs: false`).
- **Professional Excel Styling:**
  - **Yellow Header:** Header row styled with bold black text on a `#FFFF00` yellow background fill and thin borders.
  - **Center Aligned Data:** Entire sheet (headers + data rows) formatted with center vertical & horizontal alignment (`alignment: { horizontal: "center", vertical: "center" }`).
  - **No Text Wrap:** `wrapText: false` applied across all cells with automatic column width calculation (`!cols`).
  - **AutoFilter On:** Native Excel AutoFilters pre-enabled across all 35 export columns (`!autofilter`).
  - **Proper Case Text:** Converts text values to Capitalized Words while preserving IDs, phone numbers, and codes.
- **Smart Date & DateTime Formatting:** Converts raw Salesforce ISO UTC timestamps (`2026-08-07T09:15:23.000+0000`) into clean local formats:
  - **DateTime Fields** (`Upsell Assigned Date`): `DD/MM/YYYY hh:mm:ss AM/PM` (e.g., `07/08/2026 02:45:23 PM`).
  - **Date Fields** (`Order Date`): `DD/MM/YYYY` (e.g., `07/08/2026`).
- **Session Intelligence:** Automatically extracts and utilizes the active Salesforce session (`sid` cookie) on both `.lightning.force.com` and `.my.salesforce.com` domains.
- **Bulk Status Update:** Paste hundreds of Order IDs or Record IDs to perform composite REST API status updates in batches.
- **Bulk Courier Update:** Upload `.csv` / `.xlsx` files or paste Excel table rows (AWB Number, Courier Partner, Remarks, Tracking Link) for automatic column matching and batch updates.
- **Modern Glassmorphism UI:** Features animated custom checkbox toggles, styled custom dropdowns, dark mode glass visual aesthetics, smooth micro-interactions, and tabbed navigation.

---

## 📋 Export Data Scope

The extension automatically queries and extracts **35 essential order & item fields** from Salesforce, including:
- **Order Identifiers:** Salesforce Record ID, Order ID, Shopify Order ID.
- **Customer & Contact Details:** Account Name, Phone Number, Alternative Number, Full Shipping Address (Street, District, State, Pin Code).
- **Dates & Timestamps:** Order Date (`DD/MM/YYYY`) and Upsell Assigned Date (`DD/MM/YYYY hh:mm:ss AM/PM`).
- **Financial & Payment Info:** Payment Mode, Total Amount, Paid Amount, Balance Amount, Shipping Charges, and Discounts.
- **Line Items & Product Details:** Product Name, Quantity, Unit Price, List Price, Total Price, and Product ID.

---

## 🛠️ Installation

1. Clone or download this repository to your local computer.
2. Open **Google Chrome** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** and select the extension directory.
5. The extension will now appear in your browser extension toolbar.

---

## 📖 Usage Guide

### 1. Export Tab
- **Last Order ID:** Enter the starting Order ID threshold (e.g., `8950` or `ARO-8950`).
- **Include this order as well:** Tick the custom checkbox to include the specified ID in the result set.
- **Target Status:** Select the desired order status filter or leave as `All Statuses`.
- Click **Extract Orders** to generate and download the styled `.xlsx` file.

### 2. Status Tab
- Paste Order IDs or Salesforce Record IDs (one per line) into the textarea.
- Select the **New Status** from the dropdown.
- Click **Update Statuses** to execute batch composite updates.

### 3. Courier Tab
- Upload a `.csv` or `.xlsx` file via the drag-and-drop dropzone (or paste Excel table rows directly).
- The extension automatically matches column headers (`AWB Number`, `Courier Partner`, `Courier Team Remarks`, `Tracking Link`, etc.).
- Select an optional target status and click **Update Courier Info & Status**.

---

## 🏗️ Technical Architecture & Project Structure

```
Salesforce-Order-Exporter/
├── manifest.json        # Manifest V3 extension configuration & permissions
├── popup.html           # Glassmorphism HTML layout & tabbed container
├── popup.css            # Dark mode styles, custom controls, & glowing animations
├── popup.js             # SOQL query execution, XLSX styling, & batch update logic
├── background.js        # Background service worker & extension state management
├── content.js           # Content script iframe sidebar injection
├── xlsx.full.min.js     # Bundled xlsx-js-style library (supports cell formatting)
├── icon.png             # Extension app icon
└── README.md            # Comprehensive project documentation
```

### Permissions
- `activeTab`: Validates active Salesforce tab domain URLs.
- `cookies`: Authenticates session credentials via `sid` cookies for REST API calls.
- `downloads`: Directly saves exported `.xlsx` files.

---

## 📄 License

Internal Tool — Developed for Salesforce CRM Order Operations.
