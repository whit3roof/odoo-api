import { origin, dest } from "../../config/connection.js";

export const migratePurchases = async () => {
    try {
        const originDb = await origin.authenticate();
        const destinationDb = await dest.authenticate();

        const purchases = await origin.readModel(originDb, "purchase.order",
            [
                "name",
                "partner_id",
                // "state",
                "partner_ref",
                "date_approve",
                "date_planned",
                "picking_type_id",
                "receipt_status",
                "invoice_status",
                "user_id",
                "order_line"
            ],
            [],
            1
        );

        let created = 0;
        let skipped = 0;
        let failed = 0;

        for (const purchase of purchases) {
            try {
                console.log(`Migrating purchase: ${purchase.name}`);
                
                const isCreated = await dest.readModel(destinationDb, "sale.order",
                    [
                        "name"
                    ],
                    [[["name", "=", purchase.name]]]
                );
                if (isCreated.length) {
                    console.warn(`Purchase ${purchase.name} already exists`);
                    skipped++;
                    continue;
                };

                const partner = await dest.readModel(destinationDb, "res.partner",
                    [
                        "id",
                        "name"
                    ],
                    [[["name", "ilike", purchase.partner_id[1]]]],
                    1
                );
                if (!partner.length) {
                    console.warn(`!!! Partner ${purchase.partner_id[1]} not found`);
                    failed++;
                    continue;
                };

                const text = purchase.picking_type_id[1];
                const operation = text.split(":")[1].trim();
                const picking_type = await dest.readModel(destinationDb, "stock.picking.type",
                    [
                        "id",
                        "name"
                    ],
                    [[["name", "=", operation]]],
                    1
                );
                if (!picking_type.length) {
                    console.warn(`!!! Picking type ${purchase.picking_type_id[1]} not found`);
                    failed++;
                    continue;
                };

                const user = await dest.readModel(destinationDb, "res.users",
                    [
                        "id",
                        "name"
                    ],
                    [[["name", "=", purchase.user_id[1]]]],
                    1
                );
                if (!user.length) {
                    console.warn(`!!! User ${purchase.user_id[1]} not found`);
                    failed++;
                    continue;
                };

                const newPurchase = await dest.createModel(destinationDb, "purchase.order", {
                    name: purchase.name,
                    partner_id: partner[0].id,
                    // state: purchase.state,
                    partner_ref: purchase.partner_ref,
                    date_approve: purchase.date_approve,
                    date_planned: purchase.date_planned,
                    picking_type_id: picking_type[0].id,
                    receip_status: purchase.receip_status,
                    invoice_status: purchase.invoice_status,
                    user_id: user[0].id,
                });

                const lineIds = purchase.order_line;
                if (!lineIds.length) {
                    console.log(`No order lines for purchase ${purchase.name}`);
                    continue;
                };

                const orderLines = await origin.readModel(originDb, "purchase.order.line",
                    [
                        "product_id",
                        "product_qty",
                        "qty_received",
                        "qty_invoiced",
                        "price_unit",
                        "taxes_id",
                        "price_subtotal"
                    ],
                    [[["id", "in", lineIds]]]
                );

                for (const line of orderLines) {
                    try {
                        let product = await dest.readModel(destinationDb, "product.template",
                            [
                                "id",
                                "name"
                            ],
                            [[["name", "ilike", line.product_id[1]]]],
                            1
                        );
                        if (!product.length) {
                            console.warn(`!!! Product ${line.product_id[1]} not found, creating it...`);
                            const newProductId = await dest.createModel(destinationDb, "product.template", {
                                name: line.product_id[1]
                            });

                            product = [{ id: newProductId, name: line.product_id[1]}];
                        }

                        await dest.createModel(destinationDb, "purchase.order.line", {
                            order_id: newPurchase,
                            product_id: product[0].id,
                            product_qty: line.product_qty,
                            qty_received: line.qty_received,
                            qty_invoiced: line.qty_invoiced,
                            price_unit: line.price_unit,
                            price_subtotal: line.price_subtotal
                        });
                    } catch (lineError) {
                        console.error({lineError});
                    }
                }

                
                created++;
                console.log(`Purchase ${purchase.name} created`);

                try {
                    await dest.callMethod(destinationDb, "purchase.order",
                        "button_confirm",
                        [newPurchase]
                    )
                    console.log(`Purchase ${purchase.name} confirmed`);
                } catch (callMethodError) {
                    console.error({callMethodError});
                }
            } catch (error) {
                console.error(error.message);
            }
        }
    } catch (error) {

    }
}

migratePurchases();