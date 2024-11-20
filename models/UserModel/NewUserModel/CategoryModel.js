const mongoose = require('mongoose');
const { Schema } = mongoose;

// Subcategory schema
const subCategorySchema = new Schema({
  SubCategoryName: { type: String, required: true } // This will auto-generate an _id
});

// Category schema
const categorySchema = new Schema({
  CategoriesName: { type: String, required: true }, // Category name
  Code: { type: String, required: true }, // Category code
  SubCategories: [subCategorySchema] // Array of subcategories, each of which will get an _id
});

// Type schema
const typeSchema = new Schema({
  CategoryType: { type: String, required: true }, // Type of category (e.g. Current Asset)
  Categories: [categorySchema] // Array of categories, each category will have SubCategories
});

// Main category schema
const mainCategorySchema = new Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'register user', required: true }, // Reference to the user
  MainCategory: { type: String, required: true }, // Main category name (e.g., Asset)
  Types: [typeSchema] // Array of types, each type will contain Categories and SubCategories
});

// Main Category model
const CategoryModel = mongoose.model('category', mainCategorySchema);

module.exports = { CategoryModel };
