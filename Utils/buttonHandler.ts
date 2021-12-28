import { MessageComponentInteraction } from "discord.js";
import mongoSanitize from "express-mongo-sanitize";
import { getCollections } from "../mongoDB";
import generateStockpileMsg from "./generateStockpileMsg";
import updateStockpileMsg from "./updateStockpileMsg";

const buttonHandler = async (interaction: MessageComponentInteraction) => {
    const splitted = interaction.customId.split("==")
    const command = splitted[0]
    const collections = getCollections()
    console.log(command)
    await interaction.update({ content: "Working on it...", components: [] })

    if (command === "spsetamount") {
        const item = splitted[1]
        const amount = parseInt(splitted[2])
        const stockpileName = splitted[3]

        const cleanitem = item.replace(/\./g, "_").toLowerCase()

        const stockpileExist = await collections.stockpiles.findOne({ name: stockpileName })
        if (stockpileExist) {
            if (amount > 0) stockpileExist.items[cleanitem] = amount
            else delete stockpileExist.items[cleanitem]
            mongoSanitize.sanitize(stockpileExist.items, { replaceWith: "_" })
            await collections.stockpiles.updateOne({ name: stockpileName.replace(/\./g, "").replace(/\$/g, "") }, { $set: { items: stockpileExist.items, lastUpdated: new Date() } })
        }
        else {
            let itemObject: any = {}
            if (amount > 0) itemObject[cleanitem] = amount

            mongoSanitize.sanitize(itemObject, { replaceWith: "_" })
            await collections.stockpiles.insertOne({ name: stockpileName.replace(/\./g, "").replace(/\$/g, ""), items: itemObject, lastUpdated: new Date() })
            await collections.config.updateOne({}, { $push: { orderSettings: stockpileName.replace(/\./g, "").replace(/\$/g, "") } })
        }

        await interaction.update({ content: "Item `" + item + "` has been set to `" + amount + "` crates inside the stockpile `" + stockpileName + "`" })

        const [stockpileHeader, stockpileMsgs, targetMsg, stockpileMsgsHeader] = await generateStockpileMsg(true)
        await updateStockpileMsg(interaction.client, [stockpileHeader, stockpileMsgs, targetMsg, stockpileMsgsHeader])

    }
    else if (command === "spsettarget") {
        let item = splitted[1]! // Tell typescript to shut up and it is non-null
        const minimum_amount = parseInt(splitted[2])
        let maximum_amount = parseInt(splitted[3])

        const cleanitem = item.replace(/\./g, "_").toLowerCase()

        let updateObj: any = {}
        updateObj[cleanitem] = { min: minimum_amount, max: maximum_amount }
        mongoSanitize.sanitize(updateObj, { replaceWith: "_" })
        if ((await collections.targets.updateOne({}, { $set: updateObj })).modifiedCount === 0) {
            await collections.targets.insertOne(updateObj)
        }

        const [stockpileHeader, stockpileMsgs, targetMsg, stockpileMsgsHeader] = await generateStockpileMsg(true)
        await updateStockpileMsg(interaction.client, [stockpileHeader, stockpileMsgs, targetMsg, stockpileMsgsHeader])

        await interaction.update({
            content: `Item \`${item}\` has been added with a target of minimum ${minimum_amount} crates and maximum ${maximum_amount !== 0 ? maximum_amount : "unlimited"} crates.`
        });
    }
    else if (command === "cancel") {
        await interaction.update({ content: "Command cancelled", components: [] })
    }
}

export default buttonHandler