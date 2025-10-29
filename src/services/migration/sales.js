import { origin, dest } from "../../config/connection.js";

export const migrateSales = async () => {
    try {
        const originDb = await origin.authenticate();
        const destinationDb = await dest.authenticate();

        const sales = await origin.readModel(
            originDb,
            "sale.order",
            [
                "name",
                "partner_id",
                "state",
                "date_order",
                "order_line"
            ],
            [],
            3
        );

        for (const sale of sales) {
            console.log({sale});

            const lineIds = sale.order_line;
            const orderLines = await origin.readModel(
                originDb,
                "sale.order.line",
                ["product_template_id", "product_uom_qty", "qty_delivered", "qty_invoiced", "price_unit", "tax_id", "price_subtotal"],
                [[["id", "in", lineIds]]]
            );

            console.log({orderLines});
        }

        let created = 0;
        let failed = 0;

        // for (const sale of sales) {
        //     console.log(`Looking for partner: ${sale.partner_id[1]}`);
        //     try {
        //         const contact = await dest.readModel(
        //             destinationDb,
        //             "res.partner",
        //             ["id", "name"],
        //             [[["name", "ilike", sale.partner_id[1]]]],
        //             1
        //         );

        //         const newSale = await dest.createModel(destinationDb, "sale.order", {
        //             name: sale.name,
        //             partner_id: contact[0].id,
        //             state: sale.state,
        //             date_order: sale.date_order
        //         });

        //         created++;
        //         console.log(`Sale created: ${newSale}`);
        //     } catch (error) {
        //         console.error(error.message);
        //         failed++;
        //     }
        // }

        console.log(`Sales migrated: ${created}, failed: ${failed}`);
    } catch (error) {
        console.error('Sales migration failed: ', error);
    }
}

(async () => {
    await migrateSales();
})();