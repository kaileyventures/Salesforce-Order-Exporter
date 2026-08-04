document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportBtn');
    const statusMsg = document.getElementById('statusMsg');
    const lastOrderIdInput = document.getElementById('lastOrderId');
    const helperText = document.getElementById('helperText');

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetTab + 'Tab').classList.add('active');
            
            // Clear status message on tab switch
            showStatus('', '');
        });
    });

    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            // Send message to content script in the parent frame to hide
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_sidebar" });
                }
            });
        });
    }

    // Load saved last order ID
    chrome.storage.local.get(['lastExportedOrderId'], (result) => {
        if (result.lastExportedOrderId) {
            lastOrderIdInput.value = result.lastExportedOrderId;
            helperText.textContent = `Last exported: ${result.lastExportedOrderId}`;
        } else {
            helperText.textContent = "Example: ARO-8950";
        }
    });

    exportBtn.addEventListener('click', async () => {
        const lastOrderIdRaw = document.getElementById('lastOrderId').value.trim();
        const orderStatus = document.getElementById('orderStatus').value.trim();
        const includeLastOrder = document.getElementById('includeLastOrder').checked;

        if (!lastOrderIdRaw || !orderStatus) {
            showStatus('Please enter both Last Order ID and Status', 'error');
            return;
        }

        let lastOrderId = lastOrderIdRaw;
        // Pad to 8 digits if it's just numbers, as SF AutoNumbers are often 8 digits long (e.g. 00000109)
        if (/^\d+$/.test(lastOrderId)) {
             lastOrderId = lastOrderId.padStart(8, '0');
        }

        setLoading(exportBtn, true);
        showStatus('Connecting to Salesforce...', '');

        try {
            const sfSession = await getSalesforceSession();
            const { sessionId, serverUrl } = sfSession;

            showStatus('Executing SOQL query...', '');
            
            // Build the query
            let query = `
                SELECT 
                    Id, Name, CISC__OrderId__r.Name, CISC__OrderId__r.CISC__AccountId__r.Name, 
                    CISC__OrderId__r.Patient_Phone__c, CISC__OrderId__r.Alt_Phone_Shin__c, 
                    CISC__OrderId__r.CISC__Type__c, 
                    CISC__OrderId__r.Order_Team_Status__c, CISC__OrderId__r.CISC__Status__c, 
                    CISC__OrderId__r.CISC__EffectiveDate__c, CISC__OrderId__r.Payment_Mode__c, 
                    CISC__OrderId__r.CISC__TotalAmount__c, CISC__OrderId__r.Paid_Amount__c, 
                    CISC__OrderId__r.Shipping_Charge__c, CISC__OrderId__r.Discount__c, 
                    CISC__OrderId__r.Total_Amount__c, CISC__OrderId__r.Balance_Amount__c, 
                    CISC__OrderId__r.Street_1__c, CISC__OrderId__r.Street_2__c, 
                    CISC__OrderId__r.Landmark__c, CISC__OrderId__r.PickLis__c, 
                    CISC__OrderId__r.City_District__c, CISC__OrderId__r.Zip_Code__c, 
                    CISC__OrderId__r.Country__c, CISC__Quantity__c, CISC__ListPrice__c, 
                    CISC__UnitPrice__c, CISC__TotalPrice__c, CISC__ProductId__c, 
                    CISC__ProductId__r.Name, CISC__OrderId__r.Shopify_Order_Id__c,
                    CISC__OrderId__r.Owner.FirstName, CISC__OrderId__r.Owner.LastName
                FROM CISC__OrderItem__c
            `;
            
            if (includeLastOrder) {
                query += ` WHERE CISC__OrderId__r.Name >= '${lastOrderId}'`;
            } else {
                query += ` WHERE CISC__OrderId__r.Name > '${lastOrderId}'`;
            }
            
            if (orderStatus !== 'All') {
                query += ` AND CISC__OrderId__r.CISC__Status__c = '${orderStatus}'`;
            }
            
            query = query.trim().replace(/\s+/g, ' ');

            // The REST API should be called on the my.salesforce.com domain, not the lightning domain
            const apiUrl = `${serverUrl}/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${sessionId}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                let errMsg = 'Failed to fetch data from Salesforce API.';
                try {
                    const errData = await response.json();
                    if (errData && errData[0] && errData[0].message) {
                        errMsg = errData[0].message;
                    }
                } catch(e) {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            
            if (!data.records || data.records.length === 0) {
                showStatus('No records found matching criteria.', '');
                setLoading(exportBtn, false);
                return;
            }

            showStatus(`Found ${data.records.length} records. Generating CSV...`, '');
            
            const csvContent = jsonToCsv(data.records);
            downloadCsv(csvContent, `Orders_After_${lastOrderId}_${orderStatus.replace(/\s+/g, '_')}.csv`);

            // Find highest order ID to save for next time
            let maxOrderIdStr = lastOrderId;
            for (const record of data.records) {
                if (record.CISC__OrderId__r && record.CISC__OrderId__r.Name) {
                    if (record.CISC__OrderId__r.Name > maxOrderIdStr) {
                        maxOrderIdStr = record.CISC__OrderId__r.Name;
                    }
                }
            }
            
            // Save to storage
            chrome.storage.local.set({ lastExportedOrderId: maxOrderIdStr }, () => {
                const hText = document.getElementById('helperText');
                if (hText) hText.textContent = `Last exported: ${maxOrderIdStr}`;
            });

            showStatus('Export successful!', 'success');

        } catch (err) {
            showStatus(err.message, 'error');
        } finally {
            setLoading(exportBtn, false);
        }
    });

    async function getSalesforceSession() {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || (
            !tab.url.includes('salesforce.com') && 
            !tab.url.includes('force.com') && 
            !tab.url.includes('visualforce.com') && 
            !tab.url.includes('cloudforce.com')
        )) {
            throw new Error('Please open this extension on an active Salesforce tab.');
        }

        const url = new URL(tab.url);
        let apiHost = url.hostname;
        
        if (apiHost.includes('.lightning.force.com')) {
            apiHost = apiHost.replace('.lightning.force.com', '.my.salesforce.com');
        } else if (apiHost.includes('.vf.force.com')) {
            let tenant = apiHost.split('.vf.force.com')[0];
            tenant = tenant.replace(/--[a-zA-Z0-9]+$/, ''); // strip package suffix e.g. --c
            apiHost = `${tenant}.my.salesforce.com`;
        } else if (apiHost.includes('.visualforce.com')) {
            let tenant = apiHost.split('.visualforce.com')[0];
            tenant = tenant.replace(/--[a-zA-Z0-9]+$/, ''); // strip package suffix e.g. --c
            apiHost = `${tenant}.my.salesforce.com`;
        } else if (apiHost.includes('.force.com')) {
            apiHost = apiHost.replace('.force.com', '.salesforce.com');
        }

        const cookies = await chrome.cookies.getAll({ name: "sid" });
        
        let sessionId = null;
        let serverUrl = null;

        let bestCookie = cookies.find(c => c.domain === apiHost || c.domain === '.' + apiHost);
        
        if (!bestCookie) {
            // Clean up the hostname to get the base domain name (e.g. strip "--c" from "company--c.visualforce.com")
            const cleanHost = url.hostname.replace(/--[a-zA-Z0-9]+(?=\.(visualforce|vf\.force)\.com)/, '');
            const tenant = cleanHost.split('.')[0];
            bestCookie = cookies.find(c => c.domain.includes(tenant) && c.domain.includes('.salesforce.com'));
        }

        if (!bestCookie) {
            bestCookie = cookies.find(c => c.domain.includes('.salesforce.com'));
        }
        
        if (!bestCookie && cookies.length > 0) {
            bestCookie = cookies[0];
        }

        if (bestCookie) {
            sessionId = bestCookie.value;
            let cookieDomain = bestCookie.domain.replace(/^\./, '');
            serverUrl = `https://${cookieDomain}`;
        }

        if (!sessionId) {
            throw new Error('Could not find Salesforce session. Please refresh the page and make sure you are logged in.');
        }

        return { sessionId, serverUrl };
    }

    function setLoading(btn, isLoading) {
        if (isLoading) {
            btn.classList.add('btn-loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    }

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = `status-message ${type}`;
    }

    function jsonToCsv(records) {
        if (!records || !records.length) return '';
        
        // Define mapping of Salesforce field path to clean header name
        const columns = [
            { path: 'Id', header: 'Id' },
            { path: 'Name', header: 'Product Name' },
            { path: 'CISC__OrderId__r.Name', header: 'Order ID' },
            { path: 'CISC__OrderId__r.CISC__AccountId__r.Name', header: 'Account Name' },
            { path: 'CISC__OrderId__r.Patient_Phone__c', header: 'Phone Number' },
            { path: 'CISC__OrderId__r.Alt_Phone_Shin__c', header: 'Alternative Number' },
            { path: 'CISC__OrderId__r.CISC__Type__c', header: 'Order Type' },
            { path: 'CISC__OrderId__r.Order_Team_Status__c', header: 'Order Team' },
            { path: 'CISC__OrderId__r.CISC__Status__c', header: 'Status' },
            { path: 'CISC__OrderId__r.CISC__EffectiveDate__c', header: 'Order Date' },
            { path: 'CISC__OrderId__r.Payment_Mode__c', header: 'Payment Mode' },
            { path: 'CISC__OrderId__r.CISC__TotalAmount__c', header: 'Total Amount' },
            { path: 'CISC__OrderId__r.Paid_Amount__c', header: 'Paid Amount' },
            { path: 'CISC__OrderId__r.Shipping_Charge__c', header: 'Shipping Charges' },
            { path: 'CISC__OrderId__r.Discount__c', header: 'Discount' },
            { path: 'CISC__OrderId__r.Total_Amount__c', header: 'Final Amount' },
            { path: 'CISC__OrderId__r.Balance_Amount__c', header: 'Pending Amount' },
            { path: 'CISC__OrderId__r.Street_1__c', header: 'Address 1' },
            { path: 'CISC__OrderId__r.Street_2__c', header: 'Address 2' },
            { path: 'CISC__OrderId__r.Landmark__c', header: 'Landmark' },
            { path: 'CISC__OrderId__r.PickLis__c', header: 'State' },
            { path: 'CISC__OrderId__r.City_District__c', header: 'District' },
            { path: 'CISC__OrderId__r.Zip_Code__c', header: 'Pin Code' },
            { path: 'CISC__OrderId__r.Country__c', header: 'Country' },
            { path: 'CISC__OrderId__r.Shopify_Order_Id__c', header: 'Shopify Order ID' },
            { path: 'CISC__OrderId__r.Owner.FirstName', header: 'Emp Name' },
            { path: 'CISC__OrderId__r.Owner.LastName', header: 'Emp ID' },
            { path: 'CISC__Quantity__c', header: 'Quantity' },
            { path: 'CISC__ListPrice__c', header: 'List Price' },
            { path: 'CISC__UnitPrice__c', header: 'Unit Price' },
            { path: 'CISC__TotalPrice__c', header: 'Total Price' },
            { path: 'CISC__ProductId__c', header: 'Product ID' },
            { path: 'CISC__ProductId__r.Name', header: 'Product Name' }
        ];

        // Helper to clean phone numbers (keep 10 digits if Indian number, else keep as is)
        const cleanPhone = (phoneVal) => {
            if (!phoneVal) return '';
            let str = String(phoneVal).trim();
            // Remove all spaces, dashes, brackets, etc.
            let digitsOnly = str.replace(/\D/g, '');
            
            // Check if Indian number (+91..., 91..., 0..., or 10 digits)
            if (
                str.startsWith('+91') || 
                (digitsOnly.length === 12 && digitsOnly.startsWith('91')) ||
                (digitsOnly.length === 11 && digitsOnly.startsWith('0')) ||
                digitsOnly.length === 10
            ) {
                return digitsOnly.slice(-10);
            }
            return str;
        };

        // Helper to retrieve nested object value by dot-notation path
        const getValueByPath = (obj, path) => {
            const parts = path.split('.');
            let current = obj;
            for (const part of parts) {
                if (current === null || current === undefined) return '';
                current = current[part];
            }
            if (current === null || current === undefined) return '';
            
            // Trim and normalize multiple spaces
            return String(current).trim().replace(/\s+/g, ' ');
        };

        const csvRows = [];
        
        // Generate Header Row
        csvRows.push(columns.map(col => `"${col.header.replace(/"/g, '""')}"`).join(','));
        
        // Generate Data Rows
        for (const record of records) {
            const row = columns.map(col => {
                let val = getValueByPath(record, col.path);
                
                // Format phone numbers
                if (col.header === 'Phone Number' || col.header === 'Alternative Number') {
                    val = cleanPhone(val);
                }
                
                val = val.replace(/"/g, '""');
                return `"${val}"`;
            });
            csvRows.push(row.join(','));
        }
        
        // Return CSV with UTF-8 BOM to ensure proper formatting when opened in Microsoft Excel
        return '\ufeff' + csvRows.join('\n');
    }

    function downloadCsv(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true 
        });
    }

    // --- Bulk Status Update Logic ---
    const bulkUpdateStatusBtn = document.getElementById('bulkUpdateStatusBtn');
    bulkUpdateStatusBtn.addEventListener('click', async () => {
        const orderIdsRaw = document.getElementById('bulkOrderIds').value.trim();
        const targetStatus = document.getElementById('bulkTargetStatus').value.trim();

        if (!orderIdsRaw || !targetStatus) {
            showStatus('Please provide Order IDs and select a Status.', 'error');
            return;
        }

        const lines = orderIdsRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;

        setLoading(bulkUpdateStatusBtn, true);
        showStatus(`Processing ${lines.length} records...`, '');

        try {
            const { sessionId, serverUrl } = await getSalesforceSession();
            const recordsToUpdate = await resolveRecordIds(lines, targetStatus, null, sessionId, serverUrl);
            await performBulkUpdate(recordsToUpdate, sessionId, serverUrl);
            showStatus(`Successfully updated ${recordsToUpdate.length} records!`, 'success');
        } catch (err) {
            showStatus(err.message, 'error');
        } finally {
            setLoading(bulkUpdateStatusBtn, false);
        }
    });

    // --- File Dropzone & Parsing Logic ---
    const dropzone = document.getElementById('courierDropzone');
    const fileInput = document.getElementById('courierFileInput');
    const filePreviewCard = document.getElementById('filePreviewCard');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileSummaryDisplay = document.getElementById('fileSummaryDisplay');
    const fileColumnsDisplay = document.getElementById('fileColumnsDisplay');
    const removeFileBtn = document.getElementById('removeFileBtn');

    let currentParsedFile = null; // { filename, headers, rows }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleCourierFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleCourierFileSelect(e.target.files[0]);
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetCourierFile();
        });
    }

    function resetCourierFile() {
        currentParsedFile = null;
        if (fileInput) fileInput.value = '';
        if (filePreviewCard) filePreviewCard.classList.add('hidden');
    }

    function handleCourierFileSelect(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext)) {
            showStatus('Please upload a .csv, .xlsx, or .xls file.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to 2D array of strings to get raw row data
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                
                if (!rawRows || rawRows.length < 2) {
                    showStatus('File appears to be empty or missing header row.', 'error');
                    return;
                }

                const headers = rawRows[0].map(h => String(h).trim());
                const dataRows = rawRows.slice(1).filter(r => r && r.some(cell => String(cell).trim() !== ''));

                currentParsedFile = {
                    filename: file.name,
                    headers: headers,
                    rows: dataRows
                };

                if (fileNameDisplay) fileNameDisplay.textContent = file.name;
                if (fileSummaryDisplay) fileSummaryDisplay.textContent = `Loaded ${dataRows.length} record(s)`;
                if (fileColumnsDisplay) {
                    const mappedSummary = headers.filter(h => h).map(h => {
                        const field = matchHeaderToSfField(h);
                        return field ? `${h} (${field})` : h;
                    }).join(', ');
                    fileColumnsDisplay.textContent = `Columns: ${mappedSummary}`;
                }
                if (filePreviewCard) filePreviewCard.classList.remove('hidden');
                showStatus('', '');
            } catch (err) {
                console.error('File parsing error:', err);
                showStatus(`Failed to parse file: ${err.message}`, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // Smart Column Field Mapping Rules
    function matchHeaderToSfField(header) {
        if (!header) return null;
        const rawLower = String(header).toLowerCase().trim();
        const cleanSpaced = rawLower.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. Direct API Name matches
        if (rawLower === 'awb_number__c') return 'AWB_Number__c';
        if (rawLower === 'courier_partner__c') return 'Courier_Partner__c';
        if (rawLower === 'courier_partner_link__c') return 'Courier_Partner_Link__c';
        if (rawLower === 'courier_team_remarks__c') return 'Courier_Team_Remarks__c';
        if (rawLower === 'cisc__status__c') return 'CISC__Status__c';

        // 2. Remarks field (Checked BEFORE partner)
        if (
            cleanSpaced.includes('remark') ||
            cleanSpaced.includes('courier team remarks') ||
            cleanSpaced.includes('courier remarks')
        ) {
            return 'Courier_Team_Remarks__c';
        }

        // 3. Link field (Checked BEFORE partner)
        if (
            cleanSpaced.includes('link') ||
            cleanSpaced.includes('tracking url') ||
            cleanSpaced.includes('tracking link') ||
            cleanSpaced.includes('partner link')
        ) {
            return 'Courier_Partner_Link__c';
        }

        // 4. AWB Number field
        if (
            cleanSpaced.includes('awb') ||
            cleanSpaced.includes('tracking number') ||
            cleanSpaced.includes('tracking no')
        ) {
            return 'AWB_Number__c';
        }

        // 5. Courier Partner field
        if (
            cleanSpaced.includes('partner') ||
            cleanSpaced.includes('courier company') ||
            cleanSpaced.includes('carrier') ||
            cleanSpaced === 'courier' ||
            cleanSpaced === 'courier partner'
        ) {
            return 'Courier_Partner__c';
        }

        // 6. Status field
        if (cleanSpaced.includes('status')) {
            return 'CISC__Status__c';
        }

        return null;
    }

    function findIdColumnIndex(headers) {
        const cleanHeaders = headers.map(h => String(h).toLowerCase().trim());
        
        // Priority 1: Explicit Order ID / Order Name / Order Number indicators (e.g. ARO-14880)
        let idx = cleanHeaders.findIndex(h => h === 'order id' || h === 'order_id' || h === 'order name' || h === 'order' || h === 'order_number');
        if (idx !== -1) return idx;

        // Priority 2: Specific Salesforce Record ID indicators
        idx = cleanHeaders.findIndex(h => h === 'record id' || h === 'record_id' || h === 'order record id' || h === 'sf id' || h === 'salesforce id');
        if (idx !== -1) return idx;

        // Priority 3: Generic ID / Name
        idx = cleanHeaders.findIndex(h => h === 'id' || h === 'name');
        if (idx !== -1) return idx;

        // Priority 4: Any header containing 'id'
        idx = cleanHeaders.findIndex(h => h.includes('id'));
        return idx;
    }

    // --- Bulk Courier & Status Update Logic ---
    const bulkUpdateCourierBtn = document.getElementById('bulkUpdateCourierBtn');
    bulkUpdateCourierBtn.addEventListener('click', async () => {
        let headers = [];
        let dataRows = [];
        const dropdownTargetStatus = document.getElementById('courierTargetStatus').value.trim();

        if (currentParsedFile) {
            headers = currentParsedFile.headers;
            dataRows = currentParsedFile.rows;
        } else {
            const courierDataRaw = document.getElementById('bulkCourierData').value.trim();
            if (!courierDataRaw) {
                showStatus('Please upload a file (.csv / .xlsx) or paste tab-separated data.', 'error');
                return;
            }

            const rows = courierDataRaw.split('\n').map(r => r.split('\t').map(c => c.trim()));
            if (rows.length < 2) {
                showStatus('Invalid text format. Ensure there is a header row and at least one data row.', 'error');
                return;
            }

            headers = rows[0];
            dataRows = rows.slice(1);
        }

        const recordIdIdx = findIdColumnIndex(headers);
        if (recordIdIdx === -1) {
            showStatus('Could not find an "Order ID" or "Id" column in headers.', 'error');
            return;
        }

        // Filter valid data rows containing an ID
        const validRows = dataRows.filter(r => r[recordIdIdx] && String(r[recordIdIdx]).trim().length > 0);
        if (validRows.length === 0) {
            showStatus('No valid data rows found in input.', 'error');
            return;
        }

        setLoading(bulkUpdateCourierBtn, true);
        showStatus(`Processing ${validRows.length} records...`, '');

        try {
            const { sessionId, serverUrl } = await getSalesforceSession();
            
            let idOrNames = [];
            let updatesByInput = {};

            for (const row of validRows) {
                const idInput = String(row[recordIdIdx]).trim();
                idOrNames.push(idInput);

                const sfRecord = { attributes: { type: 'CISC__Order__c' } };
                
                // If user selected a global status from dropdown, apply it
                if (dropdownTargetStatus) {
                    sfRecord['CISC__Status__c'] = dropdownTargetStatus;
                }

                // Map row columns to Salesforce fields
                headers.forEach((h, idx) => {
                    if (idx === recordIdIdx) return;
                    const val = row[idx] !== undefined ? String(row[idx]).trim() : '';
                    const sfField = matchHeaderToSfField(h);

                    if (sfField && val) {
                        if (sfField === 'CISC__Status__c' && dropdownTargetStatus) {
                            // Dropdown takes precedence if selected
                        } else {
                            sfRecord[sfField] = val;
                        }
                    }
                });

                updatesByInput[idInput] = sfRecord;
            }

            const recordsToUpdate = await resolveRecordIds(idOrNames, null, updatesByInput, sessionId, serverUrl);
            await performBulkUpdate(recordsToUpdate, sessionId, serverUrl);
            showStatus(`Successfully updated ${recordsToUpdate.length} record(s)!`, 'success');

        } catch (err) {
            console.error(err);
            showStatus(err.message, 'error');
        } finally {
            setLoading(bulkUpdateCourierBtn, false);
        }
    });

    async function resolveRecordIds(inputs, targetStatus, extraFieldsMap, sessionId, serverUrl) {
        let isIdPattern = /^(?:[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/;
        let ids = [];
        let names = [];
        
        for (let val of inputs) {
            if (isIdPattern.test(val)) {
                ids.push(val);
            } else {
                // If numeric, pad to 8
                if (/^\d+$/.test(val)) val = val.padStart(8, '0');
                names.push(val);
            }
        }

        let resolvedRecords = [];

        // Add records that are already IDs
        for (let id of ids) {
            let rec = { attributes: { type: 'CISC__Order__c' }, Id: id };
            if (targetStatus) rec.CISC__Status__c = targetStatus;
            if (extraFieldsMap && extraFieldsMap[id]) {
                Object.assign(rec, extraFieldsMap[id]);
            }
            resolvedRecords.push(rec);
        }

        // Query for records that are Names
        if (names.length > 0) {
            // Chunk querying to avoid URI too long, query 50 at a time
            const chunkSize = 50;
            for (let i = 0; i < names.length; i += chunkSize) {
                const chunk = names.slice(i, i + chunkSize);
                const nameList = chunk.map(n => `'${n}'`).join(',');
                const query = `SELECT Id, Name FROM CISC__Order__c WHERE Name IN (${nameList})`;
                const apiUrl = `${serverUrl}/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;

                const response = await fetch(apiUrl, {
                    headers: { 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' }
                });

                if (!response.ok) throw new Error('Failed to query record IDs from Salesforce.');
                
                const data = await response.json();
                for (const record of data.records) {
                    let rec = { attributes: { type: 'CISC__Order__c' }, Id: record.Id };
                    if (targetStatus) rec.CISC__Status__c = targetStatus;
                    
                    let originalName = chunk.find(n => n === record.Name || (n.replace(/^0+/, '') === record.Name.replace(/^0+/, '')));
                    if (extraFieldsMap && originalName && extraFieldsMap[originalName]) {
                        Object.assign(rec, extraFieldsMap[originalName]);
                    } else if (extraFieldsMap && extraFieldsMap[record.Name]) {
                        Object.assign(rec, extraFieldsMap[record.Name]);
                    }
                    resolvedRecords.push(rec);
                }
            }
        }

        if (resolvedRecords.length === 0) {
            throw new Error('No valid records found in Salesforce for the provided inputs.');
        }

        return resolvedRecords;
    }

    async function performBulkUpdate(records, sessionId, serverUrl) {
        // SF Composite API max is 200 records per request
        const chunkSize = 200;
        const apiUrl = `${serverUrl}/services/data/v59.0/composite/sobjects`;

        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const payload = {
                allOrNone: false,
                records: chunk
            };

            const response = await fetch(apiUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${sessionId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errMsg = 'Failed to execute bulk update.';
                try {
                    const errData = await response.json();
                    if (errData && errData[0] && errData[0].message) errMsg = errData[0].message;
                } catch(e) {}
                throw new Error(errMsg);
            }

            const results = await response.json();
            const errors = results.filter(r => !r.success);
            if (errors.length > 0) {
                console.error('Update errors:', errors);
                const firstErr = (errors[0].errors && errors[0].errors[0] && errors[0].errors[0].message) 
                    ? errors[0].errors[0].message 
                    : (errors[0].statusCode || 'Unknown error');
                throw new Error(`Update failed for ${errors.length} record(s): ${firstErr}`);
            }
        }
    }
});
