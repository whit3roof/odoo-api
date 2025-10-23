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
            ],
            [],
            3
        );

        //console.log(sales)

        let created = 0;
        let failed = 0;

        for (const sale of sales) {
            console.log(`Looking for partner: ${sale.partner_id[1]}`);
            try {
                const contact = await dest.readModel(
                    destinationDb,
                    "res.partner",
                    ["id", "name"],
                    [[["name", "ilike", sale.partner_id[1]]]],
                    1
                );

                const newSale = await dest.createModel(destinationDb, "sale.order", {
                    name: sale.name,
                    partner_id: contact[0].id,
                    state: sale.state,
                });

                created++;
                console.log(`Sale created: ${newSale}`);
            } catch (error) {
                console.error(error.message);
                failed++;
            }
        }

        console.log(`Sales migrated: ${created}, failed: ${failed}`);
    } catch (error) {
        console.error('Sales migration failed: ', error);
    }
}

(async () => {
    await migrateSales();
})();