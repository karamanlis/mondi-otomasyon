import xlsx from "xlsx";
import { writeFileSync } from "fs";

const workbook = xlsx.readFile("C:\\Users\\MOROFİS\\Desktop\\mondi otomasyon\\Nova-Mondi-Home-şehirdışı-Reklamlar-29-Ağu-2026-27-Eyl-2026 (1).xlsx");
const ws = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

// rows[0] = header: Ürün ismi, Reklam Adı, Reklam Kodu, Reklam Seti Kodu, Ürün ölçüleri, Ödeme seçenekleri nedir?, Fiyat nedir?, Mağazanız nerede
const products = {};

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || !row[2]) continue; // skip empty or no ad code
  const adCode = String(row[2]).trim();
  products[adCode] = {
    adName: (row[1] || "").toString().trim(),
    adCode,
    dimensions: (row[4] || "").toString().trim(),
    paymentOptions: (row[5] || "").toString().trim(),
    priceHint: (row[6] || "").toString().trim(),
    storeAddress: (row[7] || "").toString().trim(),
  };
}

const outPath = "C:\\Users\\MOROFİS\\minimax-workspace\\mondi-otomasyon\\data\\products.json";
writeFileSync(outPath, JSON.stringify(products, null, 2), "utf-8");
const count = Object.keys(products).length;
console.log(`✓ ${count} ürün ${outPath} dosyasına yazıldı`);