const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ASSET_TYPES = [
    'D_FOREX', 'FOREX', 'GOLD', 'SILVER_5000', 'SILVER_1000',
    'OIL', 'NATURE_GAS', 'COMMODITIES', 'HKG50', 'A50',
    'JPN225', 'US_INDEX', 'SHARES', 'ETHEREUM', 'PRECIOUS_METAL',
    'BITCOIN', 'CRYPTO', 'GAUCNH',
];

const REBATE_VALUES = {
    D_FOREX: 2, FOREX: 2, GOLD: 5, SILVER_5000: 10, SILVER_1000: 3,
    OIL: 3, NATURE_GAS: 5, COMMODITIES: 1, HKG50: 3, A50: 5,
    JPN225: 8, US_INDEX: 0.5, SHARES: 0.3, ETHEREUM: 1, PRECIOUS_METAL: 3,
    BITCOIN: 1, CRYPTO: 0.5, GAUCNH: 2,
};
const MAX_PIPS = {
    D_FOREX: 12, FOREX: 12, GOLD: 20, SILVER_5000: 80, SILVER_1000: 20,
    OIL: 20, NATURE_GAS: 35, COMMODITIES: 3, HKG50: 20, A50: 40,
    JPN225: 50, US_INDEX: 2.3, SHARES: 1.5, ETHEREUM: 3, PRECIOUS_METAL: 20,
    BITCOIN: 3, CRYPTO: 1.5, GAUCNH: 7,
};

async function main() {
    const lv1 = await prisma.ibNode.findFirst({ where: { email: 'lv1-a@test.com' } });
    if (!lv1) { console.log('❌ Không tìm thấy lv1-a@test.com'); return; }

    let count = 0;
    for (const assetType of ASSET_TYPES) {
        await prisma.rebateConfig.upsert({
            where: {
                ibId_assetType_rebateType: {
                    ibId: lv1.id,
                    assetType: assetType,
                    rebateType: 'STP_REBATE',
                }
            },
            update: { rebatePips: REBATE_VALUES[assetType] },
            create: {
                ibId: lv1.id,
                assetType: assetType,
                rebateType: 'STP_REBATE',
                rebatePips: REBATE_VALUES[assetType],
                maxPips: MAX_PIPS[assetType],
            }
        });
        count++;
    }

    console.log(`✅ Đã seed ${count} rebate configs cho lv1-a@test.com (rebateType: STP_REBATE)`);
}

main()
    .catch(e => console.error('❌', e.message))
    .finally(() => prisma.$disconnect());