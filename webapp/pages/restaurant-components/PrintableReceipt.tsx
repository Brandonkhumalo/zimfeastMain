interface PrintableReceiptProps {
  order: any;
  restaurantName?: string;
}

function getOrderItems(order: any) {
  if (Array.isArray(order.items) && order.items.length > 0) return order.items;
  if (order.each_item_price && Array.isArray(order.each_item_price)) return order.each_item_price;
  return [];
}

export function printReceipt(order: any, restaurantName?: string) {
  const items = getOrderItems(order);
  const orderId = order.id ? order.id.slice(-4).toUpperCase() : "N/A";
  const date = order.createdAt || order.created
    ? new Date(order.createdAt || order.created).toLocaleString()
    : "N/A";
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.price || item.total || 0), 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const tip = Number(order.tip || 0);
  const total = Number(order.total_fee || order.total || 0);
  const method = order.method === "delivery" ? "Delivery" : "Collection";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt #${orderId}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 8mm 4mm; font-size: 12px; }
        .header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
        .header h1 { font-size: 18px; margin-bottom: 4px; }
        .header p { font-size: 11px; }
        .order-info { margin-bottom: 10px; }
        .order-info p { margin-bottom: 2px; }
        .items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .items th { text-align: left; border-bottom: 1px solid #000; padding: 4px 0; font-size: 11px; }
        .items td { padding: 3px 0; font-size: 11px; }
        .items .qty { width: 30px; text-align: center; }
        .items .price { text-align: right; width: 60px; }
        .totals { border-top: 1px dashed #000; padding-top: 8px; }
        .totals .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .totals .total-row { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 6px; margin-top: 4px; }
        .footer { text-align: center; margin-top: 16px; border-top: 1px dashed #000; padding-top: 8px; font-size: 11px; }
        @media print {
          body { width: 80mm; }
          @page { size: 80mm auto; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${restaurantName || "ZimFeast"}</h1>
        <p>Order Receipt</p>
      </div>
      <div class="order-info">
        <p><strong>Order #${orderId}</strong></p>
        <p>${date}</p>
        <p>Method: ${method}</p>
        ${order.customerPhone ? `<p>Phone: ${order.customerPhone}</p>` : ""}
      </div>
      <table class="items">
        <thead>
          <tr><th>Item</th><th class="qty">Qty</th><th class="price">Price</th></tr>
        </thead>
        <tbody>
          ${items.map((item: any) => `
            <tr>
              <td>${item.name || item.menu_item_name || "Item"}</td>
              <td class="qty">${item.quantity || 1}</td>
              <td class="price">$${((item.price || item.total || 0)).toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
        ${deliveryFee > 0 ? `<div class="row"><span>Delivery Fee</span><span>$${deliveryFee.toFixed(2)}</span></div>` : ""}
        ${tip > 0 ? `<div class="row"><span>Tip</span><span>$${tip.toFixed(2)}</span></div>` : ""}
        <div class="row total-row"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
      </div>
      <div class="footer">
        <p>Thank you for your order!</p>
        <p>Powered by ZimFeast</p>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
