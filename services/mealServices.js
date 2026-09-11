const fs = require("fs/promises");
const path = require("path");


async function getAvailableMealsLocal() {

	const filePath = path.join(__dirname, "../data/meals 1.json");
  const rawData = await fs.readFile(filePath, "utf-8");
  const parsedData = JSON.parse(rawData);


  return parsedData.map(piatto => ({
    idMeal: piatto.idMeal,
    strMeal: piatto.strMeal,
    strCategory: piatto.strCategory,
    strArea: piatto.strArea,
    strMealThumb: piatto.strMealThumb,
		strTags: piatto.strTags,
    price: piatto.price
  }));
}

module.exports = {
	getAvailableMealsLocal
};
