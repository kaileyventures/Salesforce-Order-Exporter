# Salesforce Order Exporter

A premium, production-grade Chrome Extension designed to seamlessly export orders directly from Salesforce CRM without requiring manual SOQL execution.

![App Icon](icon.png)

## Overview

The Salesforce Order Exporter provides a sleek, glassmorphism UI directly inside Chrome. It leverages your active Salesforce login session to dynamically construct and execute a SOQL query against the Salesforce REST API, downloading the results instantly as a clean CSV file.

This tool completely bypasses the need for Salesforce Inspector when your sole goal is to export orders based on ID thresholds and Status filters for third-party shipping integrations (like BlueDart, Delhivery, etc.).

## Features

- **Session Intelligence:** Automatically detects and utilizes the correct active Salesforce session (`sid` cookie) regardless of whether you are on a `.lightning.force.com` or `.my.salesforce.com` domain.
- **Export Orders:** Filters records precisely using `CISC__OrderId__r.Name` (with automatic zero-padding) and `CISC__Status__c`. Instantly parses nested JSON responses from the Salesforce API into a clean local CSV file with formatted Date and DateTime fields (such as `Upsell Assigned Date` in `DD/MM/YYYY hh:mm:ss AM/PM` format and `Order Date` in `DD/MM/YYYY` format).
- **Bulk Status Update:** Paste up to hundreds of Order IDs (or Record IDs) at once to instantly update their status without needing Data Loader or Inspector.
- **Bulk Courier Update:** Paste data directly from Excel (including Record ID, AWB Number, Courier Partner, Courier Team Remarks, and Tracking Link) to bulk update courier information on your orders.
- **Date & DateTime Formatting:** Automatically converts ISO UTC timestamps from Salesforce API into human-readable local Date & DateTime formats for seamless viewing in Microsoft Excel.
- **Premium UI/UX:** Built with a stunning dark-mode glassmorphism design, SVG iconography, smooth micro-animations, and a tabbed responsive layout.

## Installation

Since this is a custom internal tool, it is installed locally via Developer Mode:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the directory containing the extension files.
6. The extension will now appear in your toolbar (pin it for easy access).

## Usage

1. Log into your Salesforce instance in a Chrome tab.
2. Click the **Salesforce Order Exporter** extension icon.
3. **Export Tab:**
   - **Last Order ID:** Enter the ID of the last order you exported (e.g., `8950` or `ARO-8950`). 
   - **Include this order as well:** Check this box to include the entered order ID.
   - **Target Status:** Select the desired order status from the dropdown.
   - Click **Extract Orders** to generate and download the CSV.
4. **Status Tab:**
   - Paste your Order IDs (or Salesforce Record IDs), one per line, into the textarea.
   - Select the **New Status** from the dropdown.
   - Click **Update Statuses** to execute the bulk update.
5. **Courier Tab:**
   - Copy a table directly from Excel/Google Sheets. Ensure it has a header row with at least a `Record ID` or `Order ID` column. Other supported columns include `AWB Number`, `Courier Partner`, `Courier Team Remarks`, and `Tracking Link` (or `Courier Partner Link`).
   - Paste the copied table into the textarea.
   - Click **Update Courier Info** to execute the bulk update.

## Technical Stack

- **Manifest V3:** Adheres to the latest Chrome Extension security protocols.
- **HTML/CSS/JS:** Vanilla web technologies with no heavy framework dependencies.
- **Salesforce REST API:** Direct data querying (`/services/data/v59.0/query/`) and bulk updating (`/services/data/v59.0/composite/sobjects`).

## Project Structure

```
├── manifest.json      # Extension configuration and permissions
├── popup.html         # User interface structure
├── popup.css          # Glassmorphism styling and animations
├── popup.js           # Core API logic and CSV conversion
├── icon.png           # 1024x1024 High-res app icon
└── README.md          # This documentation file
```

## Permissions Justification

- `activeTab`: Required to determine the current Salesforce domain URL and ensure the user is on a valid Salesforce page.
- `cookies`: Required to securely extract the active `sid` (Session ID) cookie to authenticate the REST API calls.
- `downloads`: Required to generate and save the resulting CSV file to the user's local filesystem.
