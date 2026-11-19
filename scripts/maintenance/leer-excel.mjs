import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const dir = 'C:\\Users\\franc\\proyectos\\apps\\gymlog';
const xlsxFiles = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));

if (xlsxFiles.length === 0) {
  console.log('❌ No hay archivos .xlsx en la carpeta.');
  process.exit(1);
}

for (const file of xlsxFiles) {
  const fullPath = path.join(dir, file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(fullPath);

  console.log(`\n==================================================`);
  console.log(`📄 ARCHIVO: ${file}`);
  console.log(`==================================================`);

  const dump = {};

  workbook.eachSheet((sheet) => {
    console.log(`\n--- 📑 Hoja: ${sheet.name} (${sheet.rowCount} filas) ---`);
    const rows = [];
    let headers = [];

    sheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1).map(v =>
        v instanceof Date ? v.toISOString() : (v ?? '')
      );
      if (rowNumber === 1) {
        headers = values;
        console.log('Cabeceras:', headers.join(' | '));
      } else {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h || `col_${i + 1}`] = values[i] ?? '';
        });
        rows.push(obj);
        if (rowNumber <= 6) {
          console.log(`  Fila ${rowNumber - 1}:`, values.join(' | '));
        }
      }
    });

    if (sheet.rowCount > 6) {
      console.log(`  ... (${sheet.rowCount - 6} filas más guardadas en el JSON)`);
    }
    dump[sheet.name] = rows;
  });

  const jsonOut = fullPath.replace(/\.xlsx$/i, '.json');
  fs.writeFileSync(jsonOut, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`\n💾 Extraído a JSON legible: ${jsonOut}`);
}
