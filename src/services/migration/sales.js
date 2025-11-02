import { origin, dest } from "../../config/connection.js";

/**
 * Migrates a sale and their order lines from an origin database 
 * into the database assigned as destiny, it also creates a
 * product if it's nof found, it will not create a contact
 * if not found in order to avoid duplications for this module
 * 
 * NOTE: make sure to edit the value in line 33 as it works as
 * the migration sales limit
 */

export const migrateSales = async () => {
    try {
        const originDb = await origin.authenticate();
        const destinationDb = await dest.authenticate();

        /*
        * * Start reading for sales
        */
        const sales = await origin.readModel(
            originDb,
            "sale.order",
            [
                "name",
                "partner_id",
                "state",
                "date_order",
                "order_line",
                "payment_term_id"
            ],
            [],
            1
        );

        let created = 0;
        let failed = 0;

        /*
        * * Iterate over each sale and migrate
        */
        for (const sale of sales) {
            try {
                console.log(`\n🔹 Migrating sale: ${sale.name}`);

                // Find matching partner
                const contact = await dest.readModel(
                    destinationDb,
                    "res.partner",
                    ["id", "name"],
                    [[["name", "ilike", sale.partner_id[1]]]],
                    1
                );

                if (!contact.length) {
                    console.warn(`⚠️ Partner not found: ${sale.partner_id[1]}`);
                    failed++;
                    continue;
                }
                
                /*
                 * Handle payment term if exists 
                 */
                let paymentTermId = null;
                if (sale.payment_term_id && sale.payment_term_id.length) {
                    const termName = sale.payment_term_id[1];
                    let term = await dest.readModel(
                        destinationDb,
                        "account.payment.term",
                        ["id", "name"],
                        [[["name", "ilike", termName]]],
                        1
                    );

                    if (!term.length) {
                        console.warn(`!!! Payment term not found, creating ${termName}...`);
                        const newTermId = await dest.createModel(destinationDb, "account.payment.term", {
                            name: termName,
                        });
                        term = [{ id: newTermId, name: termName }];
                    }

                    paymentTermId = term[0].id;
                };

                // Create new sale order in destination
                const newSale = await dest.createModel(destinationDb, "sale.order", {
                    name: sale.name,
                    partner_id: contact[0].id,
                    state: sale.state,
                    date_order: sale.date_order,
                    payment_term_id: paymentTermId,
                });

                console.log(`✅ Sale created in destination: ${newSale}`);

                /*
                * * Read the order lines from the sale
                */
                const lineIds = sale.order_line;
                if (!lineIds.length) {
                    console.log(`No order lines for ${sale.name}`);
                    continue;
                }

                const orderLines = await origin.readModel(
                    originDb,
                    "sale.order.line",
                    [
                        "product_template_id",
                        "product_uom_qty",
                        "qty_delivered",
                        "qty_invoiced",
                        "price_unit",
                        "tax_id",
                        "price_subtotal"
                    ],
                    [[["id", "in", lineIds]]]
                );

                /*
                * * Create each order line in destination
                */
                for (const line of orderLines) {
                    try {
                        const productName = line.product_template_id?.[1];
                        if (!productName) {
                            console.warn(`⚠️ Missing product_template_id in line`);
                            continue;
                        }

                        // Find matching product by name in destination
                        let product = await dest.readModel(
                            destinationDb,
                            "product.template",
                            ["id", "name"],
                            [[["name", "ilike", productName]]],
                            1
                        );

                        if (!product.length) {
                            console.warn(`!!! Product not found, creating it ...`);
                            const newProductId = await dest.createModel(destinationDb, "product.template", {
                                name: productName,
                            });

                            product = [{ id: newProductId, name: productName }];
                        }

                        // Create order line linked to new sale
                        await dest.createModel(destinationDb, "sale.order.line", {
                            order_id: newSale,
                            product_id: product[0].id,
                            product_uom_qty: line.product_uom_qty,
                            qty_delivered: line.qty_delivered,
                            qty_invoiced: line.qty_invoiced,
                            price_unit: line.price_unit,
                            price_subtotal: line.price_subtotal
                        });

                        console.log(`__SUCCESS__: Line created for product: ${productName}`);
                    } catch (lineErr) {
                        console.error(`__ERROR__: creating line: ${lineErr.message}`);
                    }
                }

                created++;
            } catch (saleErr) {
                console.error(`__ERROR__: migration failed for sale ${sale.name}: ${saleErr.message}`);
                failed++;
            }
        }

        console.log(`\n__FINISHED__: Migration completed. Sales migrated: ${created}, failed: ${failed}`);
    } catch (error) {
        console.error("__ERROR__: Sales migration failed: ", error);
    }
}

(async () => {
    await migrateSales();
})();
