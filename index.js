const express = require("express");
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require("bcrypt");
const { connect } = require("./config/db");
const moment = require('moment');
const jwt = require("jsonwebtoken");
const cors = require("cors");
const verifyJWT = require("./middleware/verifyJwt")
const { BlacklistedTokenModel } = require("./models/UserModel/BacklistToken")
const server = express();
const {
  RegisteruserModel,
} = require("./models/UserModel/RegisterUserMode");
const { UserporfileModel } = require('./models/UserModel/UserProfileModel')

const { CategoryModel } = require("./models/UserModel/NewUserModel/CategoryModel");
const { AccountModel } = require("./models/UserModel/NewUserModel/AccountModel");
const { TransactionModel } = require("./models/UserModel/NewUserModel/TransactionModel");
const CarModel = require("./models/UserModel/NewUserModel/CarModel");

const InventoryModel = require("./models/UserModel/NewUserModel/InventoryModel");
const MilageModel = require("./models/UserModel/NewUserModel/MilageTrackingModel");
const { error } = require("console");

//CATEGORY JSON DATA 
//to avoid cors error//
server.use(cors({
  origin: '*', // Allows all origins
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allows specific methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allows specific headers
}));

server.use(express.json());
server.use(express.json({ limit: '10mb' })); // Set this according to your needs

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
// Serve static files from the 'uploads' directory
server.use('/uploads', express.static(path.join(__dirname, 'uploads')));

server.use(express.json());

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append the extension
  }
});

// Initialize multer with the storage configuration
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png) are allowed!'));
    }
  }
});

//welcome message
server.get("/", (req, res) => {
  res.send("welcome");
});

// Load account data from JSON file for Account
const accountData = JSON.parse(fs.readFileSync('./json/Account.json', 'utf-8'));
// Function to dynamically load categories based on UserType
const loadCategoryData = (userType) => {
  const baseDir = path.resolve(__dirname, 'json'); // Directory containing all JSON files
  let fileName;

  switch (userType) {
    case 'Individual':
      fileName = 'SoleProprietor.json';
      break;
    case 'Non-Profit':
      fileName = 'NGO.json';
      break;
    case 'Sole Proprietor':
      fileName = 'SoleProprietor.json';
      break;
    case 'Partnership':
      fileName = 'Partnership.json';
      break;
    case 'LLC':
      fileName = 'LLC.json';
      break;
    case 'Legal Industry':
      fileName = 'LegalIndustry.json';
      break;
    case 'Corporation S Corp':
      fileName = 'SCorp.json';
      break;
    case 'Corporation C Corp':
      fileName = 'CCorp.json';
      break;
    default:
      throw new Error('Invalid UserType');
  }

  const filePath = path.join(baseDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Category file not found for UserType: ${userType}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')); // Ensure full content is read
};

//USER REGISTER SECTION//   
// USER  Register//
// Route to register a user
server.post("/registeruser", async (req, res) => {
  const { name, email, phone, password, countryCode, UserType, BusinessType, BusinessCategories, state, BusinessName } = req.body;

  try {
    // Check if the email already exists in the database
    const existingInvestor = await RegisteruserModel.findOne({ email });

    if (existingInvestor) {
      // If email already exists, send an error response
      return res.status(400).send("Email already exists");
    }

    // Hash the password
    bcrypt.hash(password, 5, async (err, hash) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error hashing password");
      }

      // Create a new instance of RegisteruserModel with the hashed password
      const newData = new RegisteruserModel({
        name,
        email,
        phone,
        countryCode,
        password: hash,
        UserType,
        BusinessType,
        BusinessCategories,
        state,
        BusinessName
      });

      // Save the new user data to the database
      await newData.save();

      // Step 2: Load category data based on UserType
      let categories;
      try {
        categories = loadCategoryData(UserType);
      } catch (error) {
        console.log("Error loading categories:", error.message);
        return res.status(500).send("Error loading categories");
      }

      // Step 3: Prepare categories for the new user
      const userCategories = categories.map(category => ({
        user_id: newData._id, // Associate the new user
        MainCategory: category.MainCategory, // Main category name
        Types: category.Types.map(type => ({
          CategoryType: type.CategoryType, // Category type (e.g., "Current Asset")
          Categories: type.Categories.map(cat => ({
            CategoriesName: cat.CategoriesName, // Category name (e.g., "Allowance for Doubtful Accounts")
            Code: cat.Code, // Category code
            SubCategories: cat.SubCategories?.map(sub => (
              typeof sub === 'string'
                ? { SubCategoryName: sub }  // If sub is just a string, make it an object with SubCategoryName
                : { SubCategoryName: sub.SubCategoryName }  // If sub is already an object, keep the SubCategoryName
            ))
          }))
        }))
      }))

      // Insert categories for the new user
      const savedCategories = await CategoryModel.insertMany(userCategories);

      // Log the saved categories to verify _id generation
      console.log("Saved Categories:", savedCategories);

      // Collect the IDs of saved categories
      const categoryIds = savedCategories.map(category => category._id);
      await RegisteruserModel.findByIdAndUpdate(
        newData._id,
        { $push: { category: { $each: categoryIds } } },
        { new: true }
      );

      // Step 5: Create default accounts from Account.json
      // Step 5: Create default accounts from Account.json (use the existing accountData)
      const userAccounts = accountData.map(account => ({
        user_id: newData._id, // Associate account with new user
        AccountType: account.AccountType,
        AccountName: account.AccountName // This contains the account names and their opening balances
      }));

      // Insert default accounts for the new user
      const savedAccounts = await AccountModel.insertMany(userAccounts);

      // Push the new account IDs to the user's account field
      const accountIds = savedAccounts.map(account => account._id);
      await RegisteruserModel.findByIdAndUpdate(
        newData._id,
        { $push: { account: { $each: accountIds } } },
        { new: true }
      );

      // Send a success response
      res.status(201).send("Registered");
    });
  } catch (error) {
    // Handle other errors, such as missing details in the request
    console.log("Server Error:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

//User Login
server.post("/loginuser", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await RegisteruserModel.findOne({ email });

    if (user && user.Active) { // Check if user exists and is active
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          const token = jwt.sign(
            {
              _id: user._id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              countryCode: user.countryCode,
              UserType: user.UserType,
              BusinessType: user.BusinessType,
              BusinessCategories: user.BusinessCategories,
              state: user.state,
              BusinessName: user.BusinessName
            },
            "Tirtho",
            { expiresIn: '7d' }
          );
          res.json({
            status: "login successful",
            token: token,
          });
        } else {
          res.status(401).json({ status: "wrong entry" });
        }
      });
    } else {
      res.status(404).json({ status: "user not found" }); // Return 'user not found' if inactive
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "internal server error" });
  }
});
//Update User
// Update User
server.put("/updateuser", async (req, res) => {
  const { user_id, name, password, phone, countryCode, state, BusinessName } = req.body;

  try {
    const updateData = {};

    // Only add fields that are provided in the request to the update data
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (countryCode) updateData.countryCode = countryCode;
    if (state) updateData.state = state;
    if (BusinessName) updateData.BusinessName = BusinessName;

    // If password is provided, hash it before updating
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Find the user by ID and update the provided fields
    const user = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $set: updateData },
      { new: true }
    );

    if (user) {
      // Generate a new token with the updated information
      const token = jwt.sign(
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          countryCode: user.countryCode,
          UserType: user.UserType,
          BusinessType: user.BusinessType,
          BusinessCategories: user.BusinessCategories,
          state: user.state,
          BusinessName: user.BusinessName
        },
        "Tirtho",
        { expiresIn: '7d' }
      );

      res.json({ status: "update successful", user, token });
    } else {
      res.status(404).json({ status: "user not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "internal server error" });
  }
});


//Deactivate user account
server.post("/deactivateAccount", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await RegisteruserModel.findOne({ email });

    // Check if the user exists and is currently active
    if (user && user.Active) {
      // Verify the password
      bcrypt.compare(password, user.password, async (err, result) => {
        if (result) {
          // Set Active to false to deactivate the account
          await RegisteruserModel.findByIdAndUpdate(user._id, { Active: false });

          res.json({ status: "Account has been deactivated successfully." });
        } else {
          res.status(401).json({ status: "Incorrect password." });
        }
      });
    } else {
      res.status(404).json({ status: "User not found or already deactivated." });
    }
  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ status: "Internal server error" });
  }
});
// Create UserporfileModel CMS  populate

server.post("/userprofile", upload.fields([{ name: "profilePicture", maxCount: 1 }]), verifyJWT, async (req, res) => {
  const { user_id, address, currency, fiscal_year, balanceStartOfTheYear } = req.body;
  const profilePicturePath = req.files?.profilePicture ? req.files.profilePicture[0].path : null;

  try {
    // Check for an existing user profile for the given user_id
    let existingProfile = await UserporfileModel.findOne({ user_id });

    if (!existingProfile) {
      // Create a new profile if one doesn't exist
      const newProfile = new UserporfileModel({
        user_id,
        address,
        currency,
        fiscal_year,
        balanceStartOfTheYear,
        profilePicture: profilePicturePath // Save the path of the uploaded profile picture
      });

      // Save the new profile
      await newProfile.save();

      // Update the user's profile reference in RegisteruserModel
      await RegisteruserModel.findByIdAndUpdate(
        user_id,
        { $push: { userprofile: newProfile._id } },
        { new: true }
      );

      res.send("User profile created successfully.");
    } else {
      // Update existing profile fields if the profile already exists
      existingProfile = await UserporfileModel.findOneAndUpdate(
        { user_id },
        {
          address,
          currency,
          fiscal_year,
          balanceStartOfTheYear,
          profilePicture: profilePicturePath // Update the path of the uploaded profile picture
        },
        { new: true }
      );

      res.send("User profile updated successfully.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
// get userprofile data using populate
server.get("/userprofile/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate only the ledgers
    const user = await RegisteruserModel.findById(userId).populate('userprofile');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user?.userprofile);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
//  UserporfileModel GET All
server.get("/all-userprofile", async (req, res) => {
  try {
    const data = await UserporfileModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});






//Depreciation
// Calculate depreciation (POST request)
server.post('/calculate-depreciation', (req, res) => {
  try {
    const { cost, salvageValue, usefulLife } = req.body;

    // Check if all required fields are provided
    if (cost === undefined || salvageValue === undefined || usefulLife === undefined) {
      return res.status(400).json({ message: 'Please provide all required fields: cost, salvageValue, usefulLife' });
    }

    // Calculate straight-line depreciation
    const depreciationPerYear = (cost - salvageValue) / usefulLife;

    // Respond with the result
    res.status(200).json({
      message: 'Depreciation calculated successfully',
      data: {
        cost,
        salvageValue,
        usefulLife,
        depreciationPerYear
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating depreciation', error });
  }
});























//New Structure
//CATEGORY
// POST API to create a new category
server.post('/category', verifyJWT, async (req, res) => {
  const { user_id, MainCategory, CategoryType, Categories, Type } = req.body;

  try {
    // Check if the user exists
    const user = await RegisteruserModel.findById(user_id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare categories and subcategories
    const categoriesWithSubcategories = Categories.map(category => ({
      CategoriesName: category.CategoriesName, // Example: "Cash"
      Code: category.Code,  // Example: "1000"
      SubCategories: category.SubCategories.map(sub => ({
        SubCategoryName: sub // Subcategory name like "Bank Accounts"
      }))
    }));

    // Prepare the category types (e.g., "Current Asset")
    const categoryTypes = [{
      CategoryType: CategoryType, // Example: "Current Asset"
      Categories: categoriesWithSubcategories
    }];

    // Create a new category document with nested subdocuments
    const newCategory = new CategoryModel({
      user_id,
      MainCategory,  // Example: "Asset"
      Types: categoryTypes, // Contains the category types
    });

    // Save the new category to the database
    const savedCategory = await newCategory.save();

    // Push the new category to the user's category field in RegisteruserModel
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $push: { category: savedCategory._id } }, // Ensuring the category is updated in RegisteruserModel
      { new: true }
    );

    // Populate the category with user details
    const populatedCategory = await CategoryModel.findById(savedCategory._id)
      .populate('user_id', 'name email phone');

    res.status(201).json({
      message: 'Category created successfully',
      category: populatedCategory,
      user: updatedUser, // Returning the updated user model with the new category reference
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// get category data using populate
server.get("/category/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate only the ledgers
    const user = await RegisteruserModel.findById(userId).populate('category');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user?.category);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// UPDATE Category
server.put('/category/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { user_id, Category, Subcategory, Micro_Subcategory, Type } = req.body;

  try {
    // Step 1: Find the category by its ID
    let category = await CategoryModel.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Step 2: Check if the user is trying to update the category with a different user_id
    if (category.user_id.toString() !== user_id) {
      // Remove the category reference from the old user's category array
      await RegisteruserModel.findByIdAndUpdate(
        category.user_id,
        { $pull: { category: id } },
        { new: true }
      );

      // Add the category reference to the new user's category array
      await RegisteruserModel.findByIdAndUpdate(
        user_id,
        { $push: { category: id } },
        { new: true }
      );

      // Update the `user_id` field in the category
      category.user_id = user_id;
    }

    // Step 3: Update the rest of the category fields if provided in the request body
    category.Category = Category || category.Category; // Update the Category if provided
    category.Subcategory = Subcategory || category.Subcategory; // Update the Subcategory if provided

    // Step 4: Handle the update for Micro_Subcategory
    if (Micro_Subcategory) {
      // Map incoming Micro_Subcategory to the new structure with the `name` field
      const microSubcategories = Micro_Subcategory.map(micro => ({ name: micro }));
      category.Micro_Subcategory = microSubcategories;
    }

    // Step 5: Update the Type if provided
    category.Type = Type || category.Type;

    // Step 6: Save the updated category
    const updatedCategory = await category.save();

    // Step 7: Populate the user details for the updated category
    const populatedCategory = await CategoryModel.findById(updatedCategory._id)
      .populate('user_id', 'name email phone');

    // Step 8: Respond with the updated category
    res.status(200).json({
      message: 'Category updated successfully',
      category: populatedCategory,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE Category
server.delete('/category/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body; // Assuming user_id is sent in the body or you can adjust it accordingly

  try {
    // Step 1: Find the category by its ID
    const category = await CategoryModel.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Step 2: Remove the category ID from the user's category array
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $pull: { category: id } }, // Remove the category reference from the user's category field
      { new: true }
    );

    // Step 3: If the category is successfully removed from the user's list, proceed to delete the category
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Step 4: Delete the category from the CategoryModel collection
    await CategoryModel.findByIdAndDelete(id);

    // Step 5: Send the response with a success message
    res.status(200).json({
      message: 'Category and user reference deleted successfully',
      user: updatedUser, // Returning the updated user model after removing the category reference
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

//DELETE Many
server.delete('/category/delete-many/:user_id', async (req, res) => {
  const { user_id } = req.params; // Get user_id from the URL parameters

  try {
    // Step 1: Find categories by user_id
    const categories = await CategoryModel.find({ user_id: user_id });

    if (categories.length === 0) {
      return res.status(404).json({ message: 'No categories found for this user' });
    }

    // Step 2: Extract category IDs to be deleted
    const categoryIds = categories.map(category => category._id);

    // Step 3: Remove category IDs from the user's category array
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $pull: { category: { $in: categoryIds } } }, // Remove all category references from the user's category field
      { new: true }
    );

    // Step 4: If no user is found, return an error
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Step 5: Delete all categories from the CategoryModel collection
    await CategoryModel.deleteMany({ _id: { $in: categoryIds } });

    // Step 6: Send a success response
    res.status(200).json({
      message: 'All categories and user references deleted successfully',
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

//Account
//create account
server.post('/account', verifyJWT, async (req, res) => {
  const { user_id, AccountName, AccountType, OpeningBalance } = req.body;

  try {
    // Check if the user exists
    const user = await RegisteruserModel.findById(user_id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new account
    const newAccount = new AccountModel({
      user_id,
      AccountName,
      AccountType,
      OpeningBalance,

    });

    // Save the account to the database
    const savedAccount = await newAccount.save();

    // Push the new account to the user's account field
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $push: { account: savedAccount._id } },
      { new: true }
    );

    // Populate the user data when returning the account
    const populatedAccount = await AccountModel.findById(savedAccount._id)
      .populate('user_id', 'name email phone');

    res.status(201).json({
      message: 'Account created successfully',
      account: populatedAccount,
      user: updatedUser
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});
//get account 
server.get("/account/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate the accounts
    const user = await RegisteruserModel.findById(userId).populate('account');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user?.account);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// GET Account by ID
server.get("/account/details/:id", verifyJWT, async (req, res) => {
  const accountId = req.params.id;

  try {
    // Find the account by its ID
    const account = await AccountModel.findById(accountId)
      .populate('user_id', 'name email phone'); // Populate the user details if needed

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.status(200).json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
//update account
server.put('/account/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { user_id, AccountName, AccountType, OpeningBalance } = req.body;

  try {
    // Find the account by its ID
    let account = await AccountModel.findById(id);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Check if the user is trying to update the account with a different user_id
    if (account.user_id.toString() !== user_id) {
      // Remove the account reference from the old user's account array
      await RegisteruserModel.findByIdAndUpdate(
        account.user_id,
        { $pull: { account: id } },
        { new: true }
      );

      // Add the account reference to the new user's account array
      await RegisteruserModel.findByIdAndUpdate(
        user_id,
        { $push: { account: id } },
        { new: true }
      );

      // Update the `user_id` field in the account
      account.user_id = user_id;
    }

    // Update the rest of the account fields
    account.AccountName = AccountName || account.AccountName;
    account.AccountType = AccountType || account.AccountType;
    account.OpeningBalance = OpeningBalance || account.OpeningBalance;


    // Save the updated account
    const updatedAccount = await account.save();

    // Populate the user details for the updated account
    const populatedAccount = await AccountModel.findById(updatedAccount._id)
      .populate('user_id', 'name email phone');

    res.status(200).json({
      message: 'Account updated successfully',
      account: populatedAccount,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});
//Delete account
server.delete('/account/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body; // Assuming user_id is sent in the body or you can adjust accordingly

  try {
    // Find the account by its ID
    const account = await AccountModel.findById(id);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Remove the account ID from the user's account array
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $pull: { account: id } }, // Remove the account reference from the user's account field
      { new: true }
    );

    // Delete the account from the AccountModel collection
    await AccountModel.findByIdAndDelete(id);

    res.status(200).json({
      message: 'Account and user reference deleted successfully',
      user: updatedUser,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});



//Transaction API
//create
// Create transaction
server.post('/transaction', verifyJWT, async (req, res) => {
  const {
    user_id,
    Date,
    MainCategoryID,
    CategoryType,
    CategoriesName,
    SubCategoryName, // Expecting this as an object { SubCategoryID, name }
    AccountID,
    AccountName, // Expecting this as an object { AccountID, Name }
    Description,
    Amount,
    TransactionType,
    Notes,
    depreciationMethod, // New field
    salvagevalue,       // New field
    lifeexpectancy      // New field
  } = req.body;

  try {
    // Check if the user exists
    const user = await RegisteruserModel.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the MainCategoryID exists
    const category = await CategoryModel.findById(MainCategoryID);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if the AccountID exists
    // const account = await AccountModel.findById(AccountID);
    // if (!account) {
    //   return res.status(404).json({ message: 'Account not found' });
    // }

    // Validate that SubCategoryName has both SubCategoryID and name
    if (!SubCategoryName || !SubCategoryName.SubCategoryID || !SubCategoryName.name) {
      return res.status(400).json({ message: 'SubCategoryName with SubCategoryID and name is required' });
    }

    // Validate that AccountName has both AccountID and Name
    // if (!AccountName || !AccountName.AccountID || !AccountName.Name) {
    //   return res.status(400).json({ message: 'AccountName with AccountID and Name is required' });
    // }

    // Create a new transaction
    const newTransaction = new TransactionModel({
      user_id,
      Date,
      MainCategoryID,
      CategoryType,
      CategoriesName,
      SubCategoryName: {
        SubCategoryID: SubCategoryName.SubCategoryID,
        name: SubCategoryName.name
      },
      AccountID,
      AccountName: {
        AccountID: AccountName.AccountID,
        Name: AccountName.Name
      },
      Description,
      Amount,
      TransactionType,
      Notes,
      depreciationMethod, // New field
      salvagevalue,       // New field
      lifeexpectancy      // New field
    });

    // Save the transaction to the database
    const savedTransaction = await newTransaction.save();

    // Push the new transaction to the user's transaction field
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $push: { transaction: savedTransaction._id } },
      { new: true }
    );

    // Populate the necessary fields for response
    const populatedTransaction = await TransactionModel.findById(savedTransaction._id)
      .populate({
        path: 'user_id',
        select: 'name email phone'  // Populate user info
      })
      .populate({
        path: 'MainCategoryID',
        select: 'MainCategory'  // Populate category info
      })
      // .populate({
      //   path: 'AccountID',
      //   select: 'AccountType'  // Populate account info
      // })
      .lean();  // Return plain JavaScript object for better performance

    // Format Amount to two decimal places
    populatedTransaction.Amount = populatedTransaction.Amount.toFixed(2);

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction: populatedTransaction,
      user: updatedUser  // Include updated user details
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transactions for a user by ID, including populated CategoryID and AccountID
server.get("/transaction/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 10, MainCategoryID, startDate, endDate, sort } = req.query; // Extract filter and sort params

    // Build filters for the query


    // Build filters based on the query parameters
    const mainCategoryFilter = MainCategoryID
      ? { MainCategoryID: new mongoose.Types.ObjectId(MainCategoryID) }  // Use 'new' to instantiate ObjectId
      : {};
    const startDateFilter = startDate ? { Date: { $gte: new Date(startDate) } } : {};
    const endDateFilter = endDate ? { Date: { $lte: new Date(endDate) } } : {};

    // Combine all filters
    const filters = Object.assign({}, mainCategoryFilter, startDateFilter, endDateFilter);

    // Log the filters to debug
    console.log("Filters:", filters);

    // Find the user by ID and populate the transactions
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'transaction',
        match: filters, // Apply filters on the transaction sub-document
        populate: [
          {
            path: 'MainCategoryID',
            select: 'MainCategory'
          },
          {
            path: 'SubCategoryName.SubCategoryID',
            select: 'name'
          },
          // {
          //   path: 'AccountID',
          //   select: 'AccountType'
          // }
        ]
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let sortedTransactions = user.transaction;

    // Sorting based on the 'amount' field (High to Low / Low to High)
    if (sort === 'high-to-low') {
      sortedTransactions = sortedTransactions.sort((a, b) => b.Amount - a.Amount);
    } else if (sort === 'low-to-high') {
      sortedTransactions = sortedTransactions.sort((a, b) => a.Amount - b.Amount);
    } else {
      // Default sorting by date (latest first)
      sortedTransactions = sortedTransactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    }

    // Pagination logic
    const totalTransactions = sortedTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Paginated results
    const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

    res.status(200).json({
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages: totalPages,
      totalTransactions: totalTransactions,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});





//get transaction by  transaction ID
server.get('/transaction/details/:id', verifyJWT, async (req, res) => {
  const transactionId = req.params.id;

  try {
    // Find the transaction by ID and populate all fields
    const transaction = await TransactionModel.findById(transactionId)
      .populate({
        path: 'user_id',
        select: 'name email phone' // Adjust to include all necessary user fields
      })
      .populate({
        path: 'MainCategoryID',
        select: 'MainCategory' // Adjust to match the main category reference
      })
      .populate({
        path: 'SubCategoryName.SubCategoryID',
        select: 'name' // Adjust to include subcategory name if needed
      })
      
      // .populate({
      //   path: 'AccountID',
      //   select: 'AccountType' // Adjust to match the account reference
      // });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update transaction
// Update transaction
server.put('/transaction/:id', verifyJWT, async (req, res) => {
  const transactionId = req.params.id;
  const {
    user_id,
    Date,
    MainCategoryID,
    CategoryType,
    CategoriesName,
    SubCategoryName, // Expecting this as an object { SubCategoryID, name }
    AccountID,
    AccountName, // Expecting this as an object { AccountID, Name }
    Description,
    Amount,
    TransactionType,
    Notes
  } = req.body;

  try {
    // Find the transaction by ID
    let transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check if the user exists
    const user = await RegisteruserModel.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the MainCategoryID exists
    const category = await CategoryModel.findById(MainCategoryID);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if the AccountID exists
    const account = await AccountModel.findById(AccountID);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Validate that SubCategoryName has both SubCategoryID and name
    if (!SubCategoryName || !SubCategoryName.SubCategoryID || !SubCategoryName.name) {
      return res.status(400).json({ message: 'SubCategoryName with SubCategoryID and name is required' });
    }

    // Validate that AccountName has both AccountID and Name
    if (!AccountName || !AccountName.AccountID || !AccountName.Name) {
      return res.status(400).json({ message: 'AccountName with AccountID and Name is required' });
    }

    // Check if the user is trying to update the transaction with a different user_id
    if (transaction.user_id.toString() !== user_id) {
      // Remove the transaction reference from the old user's transaction array
      await RegisteruserModel.findByIdAndUpdate(
        transaction.user_id,
        { $pull: { transaction: transactionId } },
        { new: true }
      );

      // Add the transaction reference to the new user's transaction array
      await RegisteruserModel.findByIdAndUpdate(
        user_id,
        { $push: { transaction: transactionId } },
        { new: true }
      );

      // Update the `user_id` field in the transaction
      transaction.user_id = user_id;
    }

    // Update the transaction fields
    transaction.Date = Date || transaction.Date;
    transaction.MainCategoryID = MainCategoryID || transaction.MainCategoryID;
    transaction.CategoryType = CategoryType || transaction.CategoryType;
    transaction.CategoriesName = CategoriesName || transaction.CategoriesName;
    transaction.SubCategoryName = {
      SubCategoryID: SubCategoryName.SubCategoryID,
      name: SubCategoryName.name
    };
    transaction.AccountID = AccountID || transaction.AccountID;
    transaction.AccountName = {
      AccountID: AccountName.AccountID,
      Name: AccountName.Name
    };
    transaction.Description = Description || transaction.Description;
    transaction.Amount = Amount || transaction.Amount;
    transaction.TransactionType = TransactionType || transaction.TransactionType;
    transaction.Notes = Notes || transaction.Notes;

    // Save the updated transaction
    const updatedTransaction = await transaction.save();

    // Populate all fields for the response
    const populatedTransaction = await TransactionModel.findById(updatedTransaction._id)
      .populate({
        path: 'user_id',
        select: 'name email phone'
      })
      .populate({
        path: 'MainCategoryID',
        select: 'MainCategory'  // Populate category info
      })
      .populate({
        path: 'AccountID',
        select: 'AccountType'  // Populate account info
      })
      .lean(); // Convert to plain JavaScript object for better performance

    // Format Amount to two decimal places
    populatedTransaction.Amount = populatedTransaction.Amount.toFixed(2);

    res.status(200).json({
      message: 'Transaction updated successfully',
      transaction: populatedTransaction
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//delete
server.delete('/transaction/:id', verifyJWT, async (req, res) => {
  const transactionId = req.params.id;
  const { user_id } = req.body; // Assuming user_id is sent in the body or you can adjust it accordingly

  try {
    // Find the transaction by ID
    const transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check if the user is authorized to delete the transaction
    if (transaction.user_id.toString() !== user_id) {
      return res.status(403).json({ message: 'Unauthorized to delete this transaction' });
    }

    // Delete the transaction
    await TransactionModel.findByIdAndDelete(transactionId);

    res.status(200).json({ message: 'Transaction deleted successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});







//Margin Ration & Other Calculation
server.get("/calculate-ratios/:userId", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch user's transactions
    const user = await RegisteruserModel.findById(userId).populate({
      path: 'transaction',
      populate: {
        path: 'CategoryID',
        select: 'Category Subcategory'
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const data = user.transaction;

    // Filter and calculate Revenue
    const Revenue = data.filter(transaction => transaction.CategoryID?.Category === "Revenue");
    let totalRevenueAmount = Revenue.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate COGS
    const COGS = data.filter(transaction => transaction.CategoryID?.Category === "COGS");
    let totalCogsAmount = COGS.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Expenses
    const Expense = data.filter(transaction => transaction.CategoryID?.Category === "Expense");
    let totalExpenseAmount = Expense.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Assets
    const Assets = data.filter(transaction => transaction.CategoryID?.Category === "Assets");
    let totalAssetsAmount = Assets.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Liabilities
    const Liabilities = data.filter(transaction => transaction.CategoryID?.Category === "Liabilities");
    let totalLiabilitiesAmount = Liabilities.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Shareholder Equity
    const Shareholder = data.filter(transaction => transaction.CategoryID?.Subcategory === "Shareholder Equity");
    let totalShareholderAmount = Shareholder.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Sales
    const Sale = data.filter(transaction => transaction.CategoryID?.Subcategory === "Sales");
    let totalSaleAmount = Sale.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Inventory
    const Inventory = data.filter(transaction => transaction.CategoryID?.Subcategory === "Inventory");
    let totalInventoryAmount = Inventory.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Ratios Calculation
    const grossProfit = totalRevenueAmount - totalCogsAmount;
    const netProfit = grossProfit - totalExpenseAmount;

    const currentRatio = totalLiabilitiesAmount === 0 ? 0 : (totalAssetsAmount / totalLiabilitiesAmount).toFixed(2);
    const debtRatio = totalAssetsAmount === 0 ? 0 : ((totalLiabilitiesAmount / totalAssetsAmount) * 100).toFixed(2);
    const debtToEquityRatio = totalShareholderAmount === 0 ? 0 : ((totalLiabilitiesAmount / totalShareholderAmount) * 100).toFixed(2);
    const assetTurnoverRatio = totalAssetsAmount > 0 ? (totalSaleAmount / totalAssetsAmount).toFixed(2) : 0;
    const inventoryTurnoverRatio = totalInventoryAmount > 0 ? (totalCogsAmount / totalInventoryAmount).toFixed(2) : 0;
    const grossMarginRatio = totalSaleAmount > 0 ? (grossProfit / totalSaleAmount * 100).toFixed(2) : 0;
    const operatingMarginRatio = totalSaleAmount > 0 ? (netProfit / totalSaleAmount * 100).toFixed(2) : 0;
    const returnOnAssetsRatio = totalAssetsAmount > 0 ? (netProfit / totalAssetsAmount * 100).toFixed(2) : 0;
    const returnOnEquityRatio = totalShareholderAmount > 0 ? (netProfit / totalShareholderAmount * 100).toFixed(2) : 0;
    // Net Profit Margin Calculation
    const netProfitMarginRatio = totalRevenueAmount > 0 ? ((netProfit / totalRevenueAmount) * 100).toFixed(2) : 0;
    // Return the calculated data as a response
    res.status(200).json({
      totalRevenueAmount,
      totalCogsAmount,
      totalExpenseAmount,
      totalAssetsAmount,
      totalLiabilitiesAmount,
      totalShareholderAmount,
      totalSaleAmount,
      totalInventoryAmount,
      grossProfit,
      netProfit,
      currentRatio,
      debtRatio,
      debtToEquityRatio,
      assetTurnoverRatio,
      inventoryTurnoverRatio,
      grossMarginRatio,
      operatingMarginRatio,
      returnOnAssetsRatio,
      returnOnEquityRatio,
      netProfitMarginRatio
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
//All Ratio Compare to last Month
server.get("/calculate-ratios-compare/:userId", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch user's transactions
    const user = await RegisteruserModel.findById(userId).populate({
      path: 'transaction',
      populate: {
        path: 'CategoryID',
        select: 'Category Subcategory'
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const data = user.transaction;

    // Get the start and end of the current month and previous month
    const currentMonthStart = moment().startOf('month').toDate();
    const currentMonthEnd = moment().endOf('month').toDate();
    const previousMonthStart = moment().subtract(1, 'month').startOf('month').toDate();
    const previousMonthEnd = moment().subtract(1, 'month').endOf('month').toDate();

    // Filter transactions for current and previous month
    const currentMonthData = data.filter(transaction =>
      new Date(transaction.Date) >= currentMonthStart && new Date(transaction.Date) <= currentMonthEnd
    );

    const previousMonthData = data.filter(transaction =>
      new Date(transaction.Date) >= previousMonthStart && new Date(transaction.Date) <= previousMonthEnd
    );

    // Function to calculate ratios for a given set of transactions
    const calculateRatios = (transactions) => {
      // Filter and calculate Revenue
      const Revenue = transactions.filter(transaction => transaction.CategoryID?.Category === "Revenue");
      let totalRevenueAmount = Revenue.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate COGS
      const COGS = transactions.filter(transaction => transaction.CategoryID?.Category === "COGS");
      let totalCogsAmount = COGS.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate Expenses
      const Expense = transactions.filter(transaction => transaction.CategoryID?.Category === "Expense");
      let totalExpenseAmount = Expense.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate Assets
      const Assets = transactions.filter(transaction => transaction.CategoryID?.Category === "Assets");
      let totalAssetsAmount = Assets.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate Liabilities
      const Liabilities = transactions.filter(transaction => transaction.CategoryID?.Category === "Liabilities");
      let totalLiabilitiesAmount = Liabilities.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate Shareholder Equity
      const Shareholder = transactions.filter(transaction => transaction.CategoryID?.Subcategory === "Shareholder Equity");
      let totalShareholderAmount = Shareholder.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate Sales
      const Sale = transactions.filter(transaction => transaction.CategoryID?.Subcategory === "Sales");
      let totalSaleAmount = Sale.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Filter and calculate Inventory
      const Inventory = transactions.filter(transaction => transaction.CategoryID?.Subcategory === "Inventory");
      let totalInventoryAmount = Inventory.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

      // Ratios Calculation
      const grossProfit = totalRevenueAmount - totalCogsAmount;
      const netProfit = grossProfit - totalExpenseAmount;

      const currentRatio = totalLiabilitiesAmount === 0 ? 0 : (totalAssetsAmount / totalLiabilitiesAmount).toFixed(2);
      const debtRatio = totalAssetsAmount === 0 ? 0 : ((totalLiabilitiesAmount / totalAssetsAmount) * 100).toFixed(2);
      const debtToEquityRatio = totalShareholderAmount === 0 ? 0 : ((totalLiabilitiesAmount / totalShareholderAmount) * 100).toFixed(2);
      const assetTurnoverRatio = totalAssetsAmount > 0 ? (totalSaleAmount / totalAssetsAmount).toFixed(2) : 0;
      const inventoryTurnoverRatio = totalInventoryAmount > 0 ? (totalCogsAmount / totalInventoryAmount).toFixed(2) : 0;
      const grossMarginRatio = totalSaleAmount > 0 ? (grossProfit / totalSaleAmount * 100).toFixed(2) : 0;
      const operatingMarginRatio = totalSaleAmount > 0 ? (netProfit / totalSaleAmount * 100).toFixed(2) : 0;
      const returnOnAssetsRatio = totalAssetsAmount > 0 ? (netProfit / totalAssetsAmount * 100).toFixed(2) : 0;
      const returnOnEquityRatio = totalShareholderAmount > 0 ? (netProfit / totalShareholderAmount * 100).toFixed(2) : 0;
      // Net Profit Margin Calculation
      const netProfitMargin = totalRevenueAmount > 0 ? ((netProfit / totalRevenueAmount) * 100).toFixed(2) : 0;
      return {
        totalRevenueAmount,
        totalCogsAmount,
        totalExpenseAmount,
        totalAssetsAmount,
        totalLiabilitiesAmount,
        totalShareholderAmount,
        totalSaleAmount,
        totalInventoryAmount,
        grossProfit,
        netProfit,
        currentRatio,
        debtRatio,
        debtToEquityRatio,
        assetTurnoverRatio,
        inventoryTurnoverRatio,
        grossMarginRatio,
        operatingMarginRatio,
        returnOnAssetsRatio,
        returnOnEquityRatio,
        netProfitMargin
      };
    };

    // Calculate ratios for both the current month and the previous month
    const currentMonthRatios = calculateRatios(currentMonthData);
    const previousMonthRatios = calculateRatios(previousMonthData);

    // Return the calculated data as a response
    res.status(200).json({
      currentMonth: currentMonthRatios,
      previousMonth: previousMonthRatios
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
//ROA & ROE 6month
server.get("/calculate-roa-roe-6-month/:userId", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch user's transactions
    const user = await RegisteruserModel.findById(userId).populate({
      path: 'transaction',
      populate: {
        path: 'CategoryID',
        select: 'Category Subcategory'
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const data = user.transaction;

    // Get current date and calculate the date 6 months ago
    const currentDate = new Date();
    const sixMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 6));

    // Filter transactions from the last 6 months
    const filteredData = data.filter(transaction => new Date(transaction.Date) >= sixMonthsAgo);

    // Filter and calculate Assets from the last 6 months
    const Assets = filteredData.filter(transaction => transaction.CategoryID?.Category === "Assets");
    let totalAssetsAmount = Assets.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Liabilities from the last 6 months
    const Liabilities = filteredData.filter(transaction => transaction.CategoryID?.Category === "Liabilities");
    let totalLiabilitiesAmount = Liabilities.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Filter and calculate Shareholder Equity from the last 6 months
    const Shareholder = filteredData.filter(transaction => transaction.CategoryID?.Subcategory === "Shareholder Equity");
    let totalShareholderAmount = Shareholder.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    // Calculate Net Profit (Revenue - COGS - Expenses) for the last 6 months
    const Revenue = filteredData.filter(transaction => transaction.CategoryID?.Category === "Revenue");
    let totalRevenueAmount = Revenue.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    const COGS = filteredData.filter(transaction => transaction.CategoryID?.Category === "COGS");
    let totalCogsAmount = COGS.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    const Expense = filteredData.filter(transaction => transaction.CategoryID?.Category === "Expense");
    let totalExpenseAmount = Expense.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);

    const grossProfit = totalRevenueAmount - totalCogsAmount;
    const netProfit = grossProfit - totalExpenseAmount;

    // Calculate ROA and ROE
    const returnOnAssetsRatio = totalAssetsAmount > 0 ? (netProfit / totalAssetsAmount * 100).toFixed(2) : 0;
    const returnOnEquityRatio = totalShareholderAmount > 0 ? (netProfit / totalShareholderAmount * 100).toFixed(2) : 0;

    // Return only ROA and ROE
    res.status(200).json({
      returnOnAssetsRatio,
      returnOnEquityRatio
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// API to get the total for all AccountTypes (balance)
server.get('/all-account-balance/:userId', verifyJWT, async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user and populate the transaction's CategoryID and AccountID
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'transaction',
        populate: [
          {
            path: 'CategoryID',
            select: 'Category Subcategory Type'
          },
          {
            path: 'AccountID',
            select: 'AccountName AccountType OpeningBalance DepreciationMethod PurchaseDate UsefulLife SalvageValue AccumulatedDepreciation RemainingUsefulLife TotalUnitsExpected UnitsProduced'
          }
        ]
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const accountSums = {};

    // Loop through all transactions and group by AccountType
    user.transaction.forEach((transaction) => {
      const accountType = transaction.AccountID.AccountType;
      const openingBalance = transaction.AccountID.OpeningBalance || 0;
      const amount = transaction.Amount;

      // Initialize the accountType in the accountSums if not present
      if (!accountSums[accountType]) {
        accountSums[accountType] = {
          openingBalance: openingBalance,
          totalAmount: 0
        };
      }

      // Add amount to totalAmount for that accountType
      accountSums[accountType].totalAmount += amount;

      // For transactions beyond the first, we ignore opening balance (i.e., add only once)
      if (accountSums[accountType].totalAmount > 0 && openingBalance > 0) {
        accountSums[accountType].openingBalance = openingBalance;
      }
    });

    // Prepare the response data with each AccountType and the calculated total
    const response = Object.keys(accountSums).map(accountType => {
      const totalBalance = accountSums[accountType].openingBalance + accountSums[accountType].totalAmount;
      return {
        accountType: accountType,
        openingBalance: accountSums[accountType].openingBalance,
        totalAmount: accountSums[accountType].totalAmount,
        totalBalance: totalBalance
      };
    });

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
// Get total amounts for each category (without including Opening Balance or Account data)
server.get("/all-category-balance/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate the transactions along with CategoryID
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'transaction',
        populate: {
          path: 'CategoryID',
          select: 'Category Subcategory Type' // Adjust to include necessary fields for CategoryID
        }
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create an object to store the total amounts by category
    const categoryAmounts = {};

    // Loop through all transactions and sum amounts by category
    user.transaction.forEach((txn) => {
      const categoryName = txn.CategoryID.Category; // Assuming 'Category' contains the category name
      const amount = txn.Amount;

      if (!categoryAmounts[categoryName]) {
        categoryAmounts[categoryName] = amount;
      } else {
        categoryAmounts[categoryName] += amount;
      }
    });

    // Return the calculated amounts by category
    res.status(200).json(categoryAmounts);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// Get total amounts for each Subcategory (without including Opening Balance or Account data Array method)
server.get("/all-subcategory-balance/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate the transactions with CategoryID
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'transaction',
        populate: {
          path: 'CategoryID',
          select: 'Category Subcategory Type' // Select relevant fields from CategoryID
        }
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create an object to hold the total amount for each Subcategory
    const subcategoryTotals = {};

    // Loop through the user's transactions
    user.transaction.forEach((transaction) => {
      const subcategory = transaction.CategoryID?.Subcategory;

      if (subcategory) {
        // Sum up the amounts for each Subcategory
        if (!subcategoryTotals[subcategory]) {
          subcategoryTotals[subcategory] = transaction.Amount;
        } else {
          subcategoryTotals[subcategory] += transaction.Amount;
        }
      }
    });

    // Convert the subcategoryTotals object into an array of objects
    const subcategoryTotalsArray = Object.keys(subcategoryTotals).map(subcategory => ({
      subcategory,
      totalAmount: subcategoryTotals[subcategory]
    }));

    res.status(200).json(subcategoryTotalsArray);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// Get total amounts for each Subcategory (without including Opening Balance or Account data Object method)
server.get("/all-subcategory-balance-Object/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate the transactions with CategoryID
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'transaction',
        populate: {
          path: 'CategoryID',
          select: 'Category Subcategory Type' // Select relevant fields from CategoryID
        }
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create an object to hold the total amount for each Subcategory
    const subcategoryTotals = {};

    // Loop through the user's transactions
    user.transaction.forEach((transaction) => {
      const subcategory = transaction.CategoryID?.Subcategory;

      if (subcategory) {
        // Sum up the amounts for each Subcategory
        if (!subcategoryTotals[subcategory]) {
          subcategoryTotals[subcategory] = transaction.Amount;
        } else {
          subcategoryTotals[subcategory] += transaction.Amount;
        }
      }
    });

    // Return the subcategoryTotals object directly
    res.status(200).json(subcategoryTotals);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get total amounts for each Type (without including Opening Balance or Account data)
server.get("/all-type-balance/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and populate the transactions with CategoryID
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'transaction',
        populate: {
          path: 'CategoryID',
          select: 'Type' // Select only the Type field from CategoryID
        }
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create an object to hold the total amount for each Type
    const typeTotals = {};

    // Loop through the user's transactions
    user.transaction.forEach((transaction) => {
      const type = transaction.CategoryID?.Type;
      const amount = transaction.Amount || 0;

      if (type) {
        // Sum up the amounts for each Type
        if (!typeTotals[type]) {
          typeTotals[type] = amount;
        } else {
          typeTotals[type] += amount;
        }
      }
    });

    res.status(200).json(typeTotals);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


//Car Create
// Create a new car
server.post("/create-car", verifyJWT, async (req, res) => {
  const { user_id, modelName, vehicleNumber } = req.body;

  try {
    // Check if the user exists
    const user = await RegisteruserModel.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create a new car
    const newCar = new CarModel({
      user_id,
      modelName,
      vehicleNumber,
    });

    // Save the car to the database
    const savedCar = await newCar.save();

    // Add the car reference to the user's cars array
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $push: { cars: savedCar._id } }, // Correctly pushing the car ID to the user's cars array
      { new: true }
    );

    // Populate the car with user details
    const populatedCar = await CarModel.findById(savedCar._id)
      .populate({
        path: "user_id",
        select: "name email phone", // Populate user details
      })
      .lean();

    res.status(201).json({
      message: "Car created successfully",
      car: populatedCar,
      user: updatedUser, // Including updated user details in the response
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Fetch cars by user ID
server.get("/user-cars/:user_id", verifyJWT, async (req, res) => {
  const { user_id } = req.params;

  try {
    // Check if the user exists
    const user = await RegisteruserModel.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Populate the user's cars with details
    const populatedUser = await RegisteruserModel.findById(user_id)
      .populate({
        path: "cars",  // Path to the cars array
        select: "modelName vehicleNumber totalDistanceTravelled", // Select fields to populate
        populate: {
          path: "user_id",  // Populate user details within each car
          select: "name email phone" // Specify fields to return from user model
        }
      })
      .lean(); // Return plain JavaScript object for better performance

    // Return just the cars array
    res.status(200).json(populatedUser.cars);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});




//Milage Tracking New**************************************************


// 1. Create a new main trip (only requires date)
server.post('/create-main-trip', verifyJWT, async (req, res) => {
  const { user_id, car_id, date } = req.body;

  try {
    const newMainTrip = new MilageModel({
      user_id,
      car_id,
      date,
    });

    // Save the new main trip
    const savedTrip = await newMainTrip.save();

    // Push the new trip to the user's milage field
    const updatedUser = await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $push: { milage: savedTrip._id } },
      { new: true }
    );

    // Populate car and user details in the response
    const populatedTrip = await MilageModel.findById(savedTrip._id)
      .populate('user_id', 'name email') // Populate user details with specific fields
      .populate({
        path: 'car_id',
        select: 'modelName vehicleNumber totalDistanceTravelled',
        populate: {
          path: 'milage',
          select: 'tripName distanceTravelled date', // Select specific fields from each trip if needed
        }
      });

    res.status(201).json({
      message: 'Main trip created successfully and added to user mileage.',
      milage: populatedTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 2. End a main trip (PUT method, requires _id and other main trip details)
server.put('/end-main-trip/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { tripName, tripDescription, startPoint, endPoint, distanceTravelled, JourneyMode } = req.body;

  try {
    // Find the trip by ID and populate the car and user details along with each trip's services if needed
    const trip = await MilageModel.findById(id)
      .populate('user_id', 'name email') // Populate user details
      .populate({
        path: 'car_id',
        select: 'modelName vehicleNumber totalDistanceTravelled',
        populate: {
          path: 'milage',
          select: 'tripName distanceTravelled date', // Select specific fields from each trip
        }
      })
      .exec();

    if (!trip) return res.status(404).json({ message: 'Main trip not found' });

    // Update trip details
    trip.tripName = tripName;
    trip.tripDescription = tripDescription;
    trip.startPoint = startPoint;
    trip.endPoint = endPoint;
    trip.distanceTravelled = distanceTravelled;
    trip.JourneyMode = JourneyMode;

    const updatedTrip = await trip.save();
    res.status(200).json({
      message: 'Main trip ended successfully.',
      trip: updatedTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Delete a main trip by ID
server.delete('/delete-main-trip/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Find and delete the main trip
    const deletedTrip = await MilageModel.findByIdAndDelete(id);

    if (!deletedTrip) {
      return res.status(404).json({ message: 'Main trip not found' });
    }

    // Update the user to remove the deleted trip from their mileage field
    await RegisteruserModel.findByIdAndUpdate(
      deletedTrip.user_id,
      { $pull: { milage: id } },
      { new: true }
    );

    res.status(200).json({
      message: 'Main trip deleted successfully.',
      deletedTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//Delete Many for all Main trips 
// Delete all main trips by user_id
server.delete('/delete-all-main-trips/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    // Find all trips for the user and delete them
    const deletedTrips = await MilageModel.deleteMany({ user_id });

    if (deletedTrips.deletedCount === 0) {
      return res.status(404).json({ message: 'No trips found for this user' });
    }

    // Update the user to remove all deleted trips from their mileage field
    await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $set: { milage: [] } }, // Optionally, reset the mileage array or use $pull if you want to be more specific
      { new: true }
    );

    res.status(200).json({
      message: 'All main trips deleted successfully.',
      deletedCount: deletedTrips.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




// 3. Add a trip to the trips[] array within a main trip (requires main trip _id)
server.post('/add-trip/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { TripServices, tripName, tripDescription, startPoint, endPoint, tipReceived, date } = req.body;

  try {
    const mainTrip = await MilageModel.findById(id);
    if (!mainTrip) return res.status(404).json({ message: 'Main trip not found' });

    // Add the new trip to the trips array
    mainTrip.trips.push({
      TripServices,
      tripName,
      tripDescription,
      startPoint,
      endPoint,
      tipReceived,
      date,
    });

    const updatedMainTrip = await mainTrip.save();
    res.status(201).json({
      message: 'Trip added successfully to main trip.',
      mainTrip: updatedMainTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Delete specific trips within a main trip by trip IDs
server.delete('/delete-trips/:id', async (req, res) => {
  const { id } = req.params;
  const { tripIds } = req.body; // Expecting an array of trip IDs in the request body

  try {
    // Find the main trip
    const mainTrip = await MilageModel.findById(id);
    if (!mainTrip) {
      return res.status(404).json({ message: 'Main trip not found' });
    }

    // Filter out the trips that should be deleted
    const remainingTrips = mainTrip.trips.filter(trip => !tripIds.includes(trip._id.toString()));

    // Update the trips array
    mainTrip.trips = remainingTrips;
    const updatedMainTrip = await mainTrip.save();

    res.status(200).json({
      message: 'Selected trips deleted successfully from main trip.',
      mainTrip: updatedMainTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Delete all trips within a main trip by main trip ID
server.delete('/delete-all-trips/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Find the main trip
    const mainTrip = await MilageModel.findById(id);
    if (!mainTrip) {
      return res.status(404).json({ message: 'Main trip not found' });
    }

    // Clear the trips array
    mainTrip.trips = [];
    const updatedMainTrip = await mainTrip.save();

    res.status(200).json({
      message: 'All trips deleted successfully from main trip.',
      mainTrip: updatedMainTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


//GET MAIN TRIP
server.get('/get-main-trips/:userId', verifyJWT, async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user in RegisteruserModel and populate the milage field
    const userWithTrips = await RegisteruserModel.findById(userId)
      .populate({
        path: 'milage',

        populate: [
          { path: 'user_id', select: 'name email' }, // Populate user details
          {
            path: 'car_id',
            select: 'modelName vehicleNumber totalDistanceTravelled',
            populate: {
              path: 'milage',
              select: 'tripName distanceTravelled date',
            }
          }
        ]
      });

    // Check if the user and trips exist
    if (!userWithTrips) {
      return res.status(404).json({ message: 'User not found or no trips found for this user.' });
    }

    res.status(200).json({
      message: 'Main trips retrieved successfully.',
      user: {
        name: userWithTrips.name,
        email: userWithTrips.email,
        milage: userWithTrips.milage, // Contains populated trips
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//GET add trip (sub)
server.get('/get-trip/:milageId', verifyJWT, async (req, res) => {
  const { milageId } = req.params;

  try {
    // Find the specific mileage entry by its ID and populate the fields
    const mainTrip = await MilageModel.findById(milageId)
      .populate('user_id', 'name email') // Populate user details with specific fields
      .populate({
        path: 'car_id',
        select: 'modelName vehicleNumber totalDistanceTravelled',
        populate: {
          path: 'milage',
          select: 'tripName distanceTravelled date', // Select specific fields from each trip if needed
        }
      });

    // Check if the trip exists
    if (!mainTrip) {
      return res.status(404).json({ message: 'Mileage trip not found.' });
    }

    res.status(200).json({
      message: 'Mileage trip retrieved successfully.',
      milage: mainTrip,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//Total Distance Travel
server.get('/calculate-total-distance/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    // Find the user and populate the mileage field with trips
    const userWithTrips = await RegisteruserModel.findById(user_id)
      .populate({
        path: 'milage',
        select: 'distanceTravelled trips',
        populate: {
          path: 'trips',
          select: 'distanceTravelled',
        }
      });

    // Check if the user exists
    if (!userWithTrips || !userWithTrips.milage) {
      return res.status(404).json({ message: 'User not found or no trips found for this user.' });
    }

    // Calculate the total distance by summing up the distanceTravelled in each trip within each main trip
    let totalDistance = 0;
    userWithTrips.milage.forEach((mainTrip) => {
      // Add the distance travelled for the main trip itself if present
      if (mainTrip.distanceTravelled) totalDistance += mainTrip.distanceTravelled;

      // Add the distance travelled in each trip within the main trip
      mainTrip.trips.forEach((trip) => {
        if (trip.distanceTravelled) totalDistance += trip.distanceTravelled;
      });
    });

    res.status(200).json({
      message: 'Total distance calculated successfully.',
      totalDistance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//Total Distance By Journey mode
server.get('/calculate-distance-by-mode/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const userWithTrips = await RegisteruserModel.findById(user_id)
      .populate({
        path: 'milage',
        select: 'distanceTravelled trips JourneyMode',
        populate: {
          path: 'trips',
          select: 'distanceTravelled JourneyMode',
        }
      });

    if (!userWithTrips || !userWithTrips.milage) {
      return res.status(404).json({ message: 'User not found or no trips found for this user.' });
    }

    let totalWorkDistance = 0;
    let totalPersonalDistance = 0;

    userWithTrips.milage.forEach((mainTrip) => {
      console.log(`Main Trip JourneyMode: ${mainTrip.JourneyMode}, Distance: ${mainTrip.distanceTravelled}`);

      // Add main trip distance if applicable
      if (mainTrip.JourneyMode === 'Work' && mainTrip.distanceTravelled > 0) {
        totalWorkDistance += mainTrip.distanceTravelled;
      } else if (mainTrip.JourneyMode === 'Personal' && mainTrip.distanceTravelled > 0) {
        totalPersonalDistance += mainTrip.distanceTravelled;
      }

      // Check and add distances for each trip within the main trip
      mainTrip.trips.forEach((trip) => {
        console.log(`Trip JourneyMode: ${trip.JourneyMode}, Distance: ${trip.distanceTravelled}`);

        if (trip.JourneyMode === 'Work' && trip.distanceTravelled > 0) {
          totalWorkDistance += trip.distanceTravelled;
        } else if (trip.JourneyMode === 'Personal' && trip.distanceTravelled > 0) {
          totalPersonalDistance += trip.distanceTravelled;
        }
      });
    });

    console.log(`Total Work Distance: ${totalWorkDistance}`);
    console.log(`Total Personal Distance: ${totalPersonalDistance}`);

    res.status(200).json({
      distances: [
        { totalWorkDistance: totalWorkDistance },
        { totalPersonalDistance: totalPersonalDistance }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//Recent 5 from each Journey mode
server.get('/recent-5-trips/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the last 5 trips with JourneyMode "Work"
    const recentWorkTrips = await MilageModel.find({
      user_id: userId,
      JourneyMode: "Work",
    })
      .sort({ date: -1 }) // Sort by date in descending order
      .limit(5); // Limit to the last 5 trips

    // Find the last 5 trips with JourneyMode "Personal"
    const recentPersonalTrips = await MilageModel.find({
      user_id: userId,
      JourneyMode: "Personal",
    })
      .sort({ date: -1 }) // Sort by date in descending order
      .limit(5); // Limit to the last 5 trips

    // Send separate responses for work and personal trips
    res.status(200).json({
      work: recentWorkTrips,
      personal: recentPersonalTrips,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});










// INVENTORY 
//POST Inventory
server.post('/create-inventory', verifyJWT, async (req, res) => {
  const {
    user_id,
    itemName,
    category,
    purchaseDate,
    purchasePrice,
    quantity,
    reorderLevel,
    depreciationMethod,
    usefulLife,
    salvageValue,
    depreciationForecast, // Accepting depreciationForecast from the request body
  } = req.body;

  try {
    // Validate if the user exists
    const user = await RegisteruserModel.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new inventory item
    const newInventory = new InventoryModel({
      user_id,
      itemName,
      category,
      purchaseDate,
      purchasePrice,
      quantity,
      reorderLevel,
      depreciationMethod,
      usefulLife,
      salvageValue,
      depreciationForecast, // Directly use the forecast sent from the frontend
    });

    // Save the inventory item to the database
    const savedInventory = await newInventory.save();

    // Update the user's inventory array
    await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $push: { Inventory: savedInventory._id } }, // Add inventory reference to the user's inventories array
      { new: true }
    );

    // Populate inventory details with user information
    const populatedInventory = await InventoryModel.findById(savedInventory._id)
      .populate({
        path: 'user_id',
        select: 'name email phone', // Adjust fields as needed
      })
      .lean();

    res.status(201).json({
      inventory: populatedInventory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//GET Inventory
server.get('/inventory/:userId', verifyJWT, async (req, res) => {
  try {
    const userId = req.params.userId; // Get the user ID from the request parameters

    // Find the user by ID and populate the inventory along with Category and User details
    const user = await RegisteruserModel.findById(userId)
      .populate({
        path: 'Inventory', // Ensure this matches the field name in RegisteruserModel for the inventory array
        populate: [
          {
            path: 'category', // Populate category details
            select: 'Category Subcategory Type' // Adjust fields as necessary for the category
          },
          {
            path: 'user_id', // Populate user details if needed
            select: 'name email phone' // Adjust fields as necessary for user details
          }
        ]
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user has any inventory items
    if (user.Inventory.length === 0) {
      return res.status(404).json({ message: 'No inventory items found for this user' });
    }

    // Respond with the list of populated inventory items
    res.status(200).json(user.Inventory,);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});
//Inventory Delete
server.delete('/delete-inventory/:id', verifyJWT, async (req, res) => {
  const { id } = req.params; // Get the inventory item ID from the URL
  const { user_id } = req.body; // Ensure the user ID is included in the request body

  try {
    // Validate if the user exists
    const user = await RegisteruserModel.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find and delete the inventory item
    const deletedInventory = await InventoryModel.findByIdAndDelete(id);
    if (!deletedInventory) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Remove the inventory reference from the user's inventory array
    await RegisteruserModel.findByIdAndUpdate(
      user_id,
      { $pull: { Inventory: id } }, // Remove the inventory reference
      { new: true }
    );

    res.status(200).json({
      message: 'Inventory item deleted successfully',
      deletedInventory: deletedInventory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});











//***  STATE   Tax API     USA  */

server.post('/calculate-tax', (req, res) => {
  const { income, state } = req.body;

  if (!income || !state) {
    return res.status(400).json({ error: "Please provide both income and state." });
  }

  const netIncome = parseFloat(income);

  if (isNaN(netIncome)) {
    return res.status(400).json({ error: "Income must be a valid number." });
  }

  let taxRate = 0;
  let taxAmount = 0;

  if (state.toLowerCase() === 'alabama') {
    if (netIncome > 50000) {
      taxRate = 6.5;
    } else if (netIncome > 25000) {
      taxRate = 6;
    } else if (netIncome > 10000) {
      taxRate = 5;
    } else if (netIncome > 5000) {
      taxRate = 4;
    } else if (netIncome > 2500) {
      taxRate = 3;
    } else {
      taxRate = 2;
    }
    taxAmount = (netIncome * taxRate) / 100;

  } else if (state.toLowerCase() === 'alaska') {
    taxRate = 0;
    taxAmount = 0;

  } else if (state.toLowerCase() === 'arizona') {
    if (netIncome > 250000) {
      taxRate = 1;
      taxAmount = (netIncome * taxRate) / 100 + 10029;
      taxAmount += (netIncome * 3.5) / 100; // 3.5% surcharge
    } else if (netIncome > 166843) {
      taxRate = 4.5;
      taxAmount = (netIncome * taxRate) / 100 + 6287;
    } else if (netIncome > 55615) {
      taxRate = 4.17;
      taxAmount = (netIncome * taxRate) / 100 + 1649;
    } else if (netIncome > 27808) {
      taxRate = 3.34;
      taxAmount = (netIncome * taxRate) / 100 + 720;
    } else {
      taxRate = 2.59;
      taxAmount = (netIncome * taxRate) / 100;
    }

  } else if (state.toLowerCase() === 'arkansas') {
    if (netIncome > 100000) {
      taxRate = 6.9;
    } else if (netIncome > 50000) {
      taxRate = 6;
    } else if (netIncome > 25000) {
      taxRate = 5;
    } else if (netIncome > 10000) {
      taxRate = 4;
    } else if (netIncome > 5000) {
      taxRate = 3;
    } else if (netIncome > 2500) {
      taxRate = 2;
    } else {
      taxRate = 1.5;
    }
    taxAmount = (netIncome * taxRate) / 100;

  } else if (state.toLowerCase() === 'california') {
    if (netIncome > 698271) {
      taxAmount = 67876.49 + (netIncome - 698271) * 0.123;
    } else if (netIncome > 418961) {
      taxAmount = 36314.46 + (netIncome - 418961) * 0.113;
    } else if (netIncome > 349137) {
      taxAmount = 29122.59 + (netIncome - 349137) * 0.103;
    } else if (netIncome > 68350) {
      taxAmount = 3009.40 + (netIncome - 68350) * 0.093;
    } else if (netIncome > 54081) {
      taxAmount = 1867.88 + (netIncome - 54081) * 0.08;
    } else if (netIncome > 38959) {
      taxAmount = 960.56 + (netIncome - 38959) * 0.06;
    } else if (netIncome > 24684) {
      taxAmount = 389.56 + (netIncome - 24684) * 0.04;
    } else if (netIncome > 10412) {
      taxAmount = 104.12 + (netIncome - 10412) * 0.02;
    } else {
      taxAmount = netIncome * 0.01;
    }

  } else if (state.toLowerCase() === 'colorado') {
    taxRate = 4.5; // Flat tax rate for Colorado
    taxAmount = (netIncome * taxRate) / 100;

  } else if (state.toLowerCase() === 'connecticut') {
    if (netIncome > 500000) {
      taxAmount = 31550 + (netIncome - 500000) * 0.0699;
    } else if (netIncome > 250000) {
      taxAmount = 14300 + (netIncome - 250000) * 0.069;
    } else if (netIncome > 200000) {
      taxAmount = 11050 + (netIncome - 200000) * 0.065;
    } else if (netIncome > 100000) {
      taxAmount = 5050 + (netIncome - 100000) * 0.06;
    } else if (netIncome > 50000) {
      taxAmount = 2300 + (netIncome - 50000) * 0.055;
    } else if (netIncome > 10000) {
      taxAmount = 300 + (netIncome - 10000) * 0.05;
    } else {
      taxAmount = (netIncome * 0.03);
    }

  } else if (state.toLowerCase() === 'delaware') {
    if (netIncome > 60000) {
      taxAmount = (netIncome * 6.6) / 100; // 6.6% for income over $60,000
    } else if (netIncome > 25000) {
      taxAmount = 1385 + (netIncome - 25000) * 0.0555; // $1385 for income between $25,001 and $60,000
    } else if (netIncome > 20000) {
      taxAmount = 1040 + (netIncome - 20000) * 0.052; // $1040 for income between $20,001 and $25,000
    } else if (netIncome > 10000) {
      taxAmount = 480 + (netIncome - 10000) * 0.048; // $480 for income between $10,001 and $20,000
    } else if (netIncome > 5000) {
      taxAmount = (netIncome - 5000) * 0.039; // 3.9% for income between $5,001 and $10,000
    } else if (netIncome > 2000) {
      taxAmount = (netIncome - 2000) * 0.022; // 2.2% for income between $2,001 and $5,000
    } else {
      taxAmount = 0; // 0% for income $2,000 and below
    }

  } else if (state.toLowerCase() === 'florida') {
    taxRate = 0; // 0% tax rate for Florida
    taxAmount = 0; // No tax amount for Florida

  } else if (state.toLowerCase() === 'georgia') {
    if (netIncome > 7000) {
      taxAmount = 230 + (netIncome - 7000) * 0.0575; // $230 + 5.75% of the excess over $7,000
    } else if (netIncome > 5250) {
      taxAmount = 143 + (netIncome - 5250) * 0.05; // $143 + 5% of the excess over $5,250
    } else if (netIncome > 3750) {
      taxAmount = 83 + (netIncome - 3750) * 0.04; // $83 + 4% of the excess over $3,750
    } else if (netIncome > 2250) {
      taxAmount = 38 + (netIncome - 2250) * 0.03; // $38 + 3% of the excess over $2,250
    } else if (netIncome > 750) {
      taxAmount = 8 + (netIncome - 750) * 0.02; // $8 + 2% of the excess over $750
    } else {
      taxAmount = (netIncome * 0.01); // 1% of the income for $750 and below
    }

  } else if (state.toLowerCase() === 'hawaii') {
    if (netIncome > 400000) {
      taxAmount = 16379 + (netIncome - 400000) * 0.11; // $16,379 + 11% of the excess over $400,000
    } else if (netIncome > 200000) {
      taxAmount = 13879 + (netIncome - 200000) * 0.10; // $13,879 + 10% of the excess over $200,000
    } else if (netIncome > 175000) {
      taxAmount = 11629 + (netIncome - 175000) * 0.09; // $11,629 + 9% of the excess over $175,000
    } else if (netIncome > 48000) {
      taxAmount = 3214 + (netIncome - 48000) * 0.0825; // $3,214 + 8.25% of the excess over $48,000
    } else if (netIncome > 36000) {
      taxAmount = 2266 + (netIncome - 36000) * 0.079; // $2,266 + 7.9% of the excess over $36,000
    } else if (netIncome > 24000) {
      taxAmount = 1354 + (netIncome - 24000) * 0.076; // $1,354 + 7.6% of the excess over $24,000
    } else if (netIncome > 19200) {
      taxAmount = 1008 + (netIncome - 19200) * 0.068; // $1,008 + 6.8% of the excess over $19,200
    } else if (netIncome > 14400) {
      taxAmount = 374 + (netIncome - 14400) * 0.064; // $374 + 6.4% of the excess over $14,400
    } else if (netIncome > 4800) {
      taxAmount = 110 + (netIncome - 4800) * 0.055; // $110 + 5.5% of the excess over $4,800
    } else if (netIncome > 2400) {
      taxAmount = 34 + (netIncome - 2400) * 0.032; // $34 + 3.2% of the excess over $2,400
    } else {
      taxAmount = (netIncome * 0.014); // 1.4% of the income for $2,400 and below
    }

  } else if (state.toLowerCase() === 'idaho') {
    taxRate = 6; // Flat tax rate for Idaho
    taxAmount = (netIncome * taxRate) / 100; // 6% of net income

  } else if (state.toLowerCase() === 'idaho') {
    const taxRate = 6; // Flat tax rate for Idaho
    taxAmount = (netIncome * taxRate) / 100; // 6% of net income

  } else if (state.toLowerCase() === 'illinois') {
    const taxRate = 4.95; // Flat tax rate for Illinois
    taxAmount = (netIncome * taxRate) / 100; // 4.95% of net income

  } else if (state.toLowerCase() === 'indiana') {
    const taxRate = 3.23; // Flat tax rate for Indiana
    taxAmount = (netIncome * taxRate) / 100; // 3.23% of net income

  } else if (state.toLowerCase() === 'iowa') {
    const taxRate = 6; // Flat tax rate for Iowa
    taxAmount = (netIncome * taxRate) / 100; // 6% of net income

  } else if (state.toLowerCase() === 'kansas') {
    if (netIncome <= 3000) {
      taxAmount = (netIncome * 2.7) / 100;
    } else if (netIncome <= 15000) {
      taxAmount = (3000 * 2.7) / 100 + ((netIncome - 3000) * 3.5) / 100;
    } else if (netIncome <= 30000) {
      taxAmount = (3000 * 2.7) / 100 + (12000 * 3.5) / 100 + ((netIncome - 15000) * 4.5) / 100;
    } else if (netIncome <= 60000) {
      taxAmount = (3000 * 2.7) / 100 + (12000 * 3.5) / 100 + (15000 * 4.5) / 100 + ((netIncome - 30000) * 5.25) / 100;
    } else {
      taxAmount = (3000 * 2.7) / 100 + (12000 * 3.5) / 100 + (15000 * 4.5) / 100 + (30000 * 5.25) / 100 + ((netIncome - 60000) * 5.7) / 100;
    }

  } else if (state.toLowerCase() === 'kentucky') {
    if (netIncome <= 2500) {
      taxAmount = (netIncome * 1.5) / 100;
    } else if (netIncome <= 5000) {
      taxAmount = (2500 * 1.5) / 100 + ((netIncome - 2500) * 2) / 100;
    } else if (netIncome <= 10000) {
      taxAmount = (2500 * 1.5) / 100 + (2500 * 2) / 100 + ((netIncome - 5000) * 3) / 100;
    } else if (netIncome <= 25000) {
      taxAmount = (2500 * 1.5) / 100 + (2500 * 2) / 100 + (5000 * 3) / 100 + ((netIncome - 10000) * 4) / 100;
    } else {
      taxAmount = (2500 * 1.5) / 100 + (2500 * 2) / 100 + (5000 * 3) / 100 + (15000 * 4) / 100 + ((netIncome - 25000) * 5.8) / 100;
    }

  } else if (state.toLowerCase() === 'louisiana') {
    if (netIncome <= 13500) {
      taxAmount = (netIncome * 2) / 100;
    } else if (netIncome <= 27500) {
      taxAmount = (13500 * 2) / 100 + ((netIncome - 13500) * 3) / 100;
    } else if (netIncome <= 55000) {
      taxAmount = (13500 * 2) / 100 + (14000 * 3) / 100 + ((netIncome - 27500) * 4) / 100;
    } else if (netIncome <= 90000) {
      taxAmount = (13500 * 2) / 100 + (14000 * 3) / 100 + (27500 * 4) / 100 + ((netIncome - 55000) * 5) / 100;
    } else {
      taxAmount = (13500 * 2) / 100 + (14000 * 3) / 100 + (27500 * 4) / 100 + (35000 * 5) / 100 + ((netIncome - 90000) * 6) / 100;
    }

  } else if (state.toLowerCase() === 'maine') {
    if (netIncome <= 12500) {
      taxAmount = (netIncome * 2.8) / 100;
    } else if (netIncome <= 25000) {
      taxAmount = (12500 * 2.8) / 100 + ((netIncome - 12500) * 3.9) / 100;
    } else if (netIncome <= 37500) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + ((netIncome - 25000) * 4.8) / 100;
    } else if (netIncome <= 50000) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + ((netIncome - 37500) * 5.8) / 100;
    } else if (netIncome <= 75000) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + (12500 * 5.8) / 100 + ((netIncome - 50000) * 6.75) / 100;
    } else if (netIncome <= 100000) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + (12500 * 5.8) / 100 + (25000 * 6.75) / 100 + ((netIncome - 75000) * 7.5) / 100;
    } else {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + (12500 * 5.8) / 100 + (25000 * 6.75) / 100 + (25000 * 7.5) / 100 + ((netIncome - 100000) * 9.9) / 100;
    }

  } else if (state.toLowerCase() === 'maryland') {
    if (netIncome <= 1000) {
      taxAmount = (netIncome * 2) / 100;
    } else if (netIncome <= 2000) {
      taxAmount = (1000 * 2) / 100 + ((netIncome - 1000) * 3) / 100;
    } else if (netIncome <= 3000) {
      taxAmount = (1000 * 2) / 100 + (1000 * 3) / 100 + ((netIncome - 2000) * 4) / 100;
    } else if (netIncome <= 100000) {
      taxAmount = (1000 * 2) / 100 + (1000 * 3) / 100 + (1000 * 4) / 100 + ((netIncome - 3000) * 4.75) / 100;
    } else if (netIncome <= 125000) {
      taxAmount = (1000 * 2) / 100 + (1000 * 3) / 100 + (1000 * 4) / 100 + (97000 * 4.75) / 100 + ((netIncome - 100000) * 5) / 100;
    } else if (netIncome <= 150000) {
      taxAmount = (1000 * 2) / 100 + (1000 * 3) / 100 + (1000 * 4) / 100 + (97000 * 4.75) / 100 + (25000 * 5) / 100 + ((netIncome - 125000) * 5.25) / 100;
    } else if (netIncome <= 250000) {
      taxAmount = (1000 * 2) / 100 + (1000 * 3) / 100 + (1000 * 4) / 100 + (97000 * 4.75) / 100 + (25000 * 5) / 100 + (25000 * 5.25) / 100 + ((netIncome - 150000) * 5.5) / 100;
    } else {
      taxAmount = (1000 * 2) / 100 + (1000 * 3) / 100 + (1000 * 4) / 100 + (97000 * 4.75) / 100 + (25000 * 5) / 100 + (25000 * 5.25) / 100 + (100000 * 5.5) / 100 + ((netIncome - 250000) * 5.75) / 100;
    }

  } else if (state.toLowerCase() === 'massachusetts') {
    if (netIncome <= 12500) {
      taxAmount = (netIncome * 2.8) / 100;
    } else if (netIncome <= 25000) {
      taxAmount = (12500 * 2.8) / 100 + ((netIncome - 12500) * 3.9) / 100;
    } else if (netIncome <= 37500) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + ((netIncome - 25000) * 4.8) / 100;
    } else if (netIncome <= 50000) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + ((netIncome - 37500) * 5.8) / 100;
    } else if (netIncome <= 75000) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + (12500 * 5.8) / 100 + ((netIncome - 50000) * 6.75) / 100;
    } else if (netIncome <= 100000) {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + (12500 * 5.8) / 100 + (25000 * 6.75) / 100 + ((netIncome - 75000) * 7.5) / 100;
    } else {
      taxAmount = (12500 * 2.8) / 100 + (12500 * 3.9) / 100 + (12500 * 4.8) / 100 + (12500 * 5.8) / 100 + (25000 * 6.75) / 100 + (25000 * 7.5) / 100 + ((netIncome - 100000) * 9.9) / 100;
    }

  } else if (state.toLowerCase() === 'michigan') {
    if (netIncome <= 10000) {
      taxAmount = (netIncome * 2.6) / 100;
    } else if (netIncome <= 25000) {
      taxAmount = (10000 * 2.6) / 100 + ((netIncome - 10000) * 3.9) / 100;
    } else if (netIncome <= 50000) {
      taxAmount = (10000 * 2.6) / 100 + (15000 * 3.9) / 100 + ((netIncome - 25000) * 4.25) / 100;
    } else if (netIncome <= 100000) {
      taxAmount = (10000 * 2.6) / 100 + (15000 * 3.9) / 100 + (25000 * 4.25) / 100 + ((netIncome - 50000) * 6.25) / 100;
    } else {
      taxAmount = (10000 * 2.6) / 100 + (15000 * 3.9) / 100 + (25000 * 4.25) / 100 + (50000 * 6.25) / 100 + ((netIncome - 100000) * 6.3) / 100;
    }

  } else if (state.toLowerCase() === 'minnesota') {
    if (netIncome <= 17200) {
      taxAmount = (netIncome * 5.35) / 100;
    } else if (netIncome <= 26800) {
      taxAmount = (17200 * 5.35) / 100 + ((netIncome - 17200) * 7.85) / 100;
    } else if (netIncome <= 44100) {
      taxAmount = (17200 * 5.35) / 100 + (9600 * 7.85) / 100 + ((netIncome - 26800) * 9.85) / 100;
    } else if (netIncome <= 88200) {
      taxAmount = (17200 * 5.35) / 100 + (9600 * 7.85) / 100 + (17300 * 9.85) / 100 + ((netIncome - 44100) * 9.87) / 100;
    } else {
      taxAmount = (17200 * 5.35) / 100 + (9600 * 7.85) / 100 + (17300 * 9.85) / 100 + (44100 * 9.87) / 100 + ((netIncome - 88200) * 10.55) / 100;
    }

  } else if (state.toLowerCase() === 'mississippi') {
    if (netIncome <= 10000) {
      taxAmount = (netIncome * 2) / 100;
    } else if (netIncome <= 25000) {
      taxAmount = (10000 * 2) / 100 + ((netIncome - 10000) * 3) / 100;
    } else if (netIncome <= 50000) {
      taxAmount = (10000 * 2) / 100 + (15000 * 3) / 100 + ((netIncome - 25000) * 4) / 100;
    } else if (netIncome <= 100000) {
      taxAmount = (10000 * 2) / 100 + (15000 * 3) / 100 + (25000 * 4) / 100 + ((netIncome - 50000) * 5) / 100;
    } else {
      taxAmount = (10000 * 2) / 100 + (15000 * 3) / 100 + (25000 * 4) / 100 + (50000 * 5) / 100 + ((netIncome - 100000) * 6) / 100;
    }

  } else if (state.toLowerCase() === 'missouri') {
    if (netIncome <= 108) {
      taxAmount = 0;
    } else if (netIncome <= 1088) {
      taxAmount = (netIncome * 1.5) / 100;
    } else if (netIncome <= 2176) {
      taxAmount = 16 + ((netIncome - 1088) * 2.0) / 100;
    } else if (netIncome <= 3264) {
      taxAmount = 38 + ((netIncome - 2176) * 2.5) / 100;
    } else if (netIncome <= 4352) {
      taxAmount = 65 + ((netIncome - 3264) * 3.0) / 100;
    } else if (netIncome <= 5440) {
      taxAmount = 98 + ((netIncome - 4352) * 3.5) / 100;
    } else if (netIncome <= 6528) {
      taxAmount = 136 + ((netIncome - 5440) * 4.0) / 100;
    } else if (netIncome <= 7616) {
      taxAmount = 180 + ((netIncome - 6528) * 4.5) / 100;
    } else if (netIncome <= 8704) {
      taxAmount = 229 + ((netIncome - 7616) * 5.0) / 100;
    } else {
      taxAmount = 283 + ((netIncome - 8704) * 5.4) / 100;
    }

  } else if (state.toLowerCase() === 'montana') {
    if (netIncome <= 3300) {
      taxAmount = (netIncome * 1) / 100;
    } else if (netIncome <= 5800) {
      taxAmount = (netIncome * 2) / 100 - 33;
    } else if (netIncome <= 8900) {
      taxAmount = (netIncome * 3) / 100 - 91;
    } else if (netIncome <= 12000) {
      taxAmount = (netIncome * 4) / 100 - 180;
    } else if (netIncome <= 15400) {
      taxAmount = (netIncome * 5) / 100 - 300;
    } else if (netIncome <= 19800) {
      taxAmount = (netIncome * 6) / 100 - 454;
    } else {
      taxAmount = (netIncome * 6.75) / 100 - 603;
    }

  } else if (state.toLowerCase() === 'nebraska') {
    if (netIncome <= 3000) {
      taxAmount = (netIncome * 2.47) / 100;
    } else if (netIncome <= 15000) {
      taxAmount = (3000 * 2.47) / 100 + ((netIncome - 3000) * 3.30) / 100;
    } else if (netIncome <= 30000) {
      taxAmount = (3000 * 2.47) / 100 + (12000 * 3.30) / 100 + ((netIncome - 15000) * 4.29) / 100;
    } else if (netIncome <= 60000) {
      taxAmount = (3000 * 2.47) / 100 + (12000 * 3.30) / 100 + (15000 * 4.29) / 100 + ((netIncome - 30000) * 5.06) / 100;
    } else {
      taxAmount = (3000 * 2.47) / 100 + (12000 * 3.30) / 100 + (15000 * 4.29) / 100 + (30000 * 5.06) / 100 + ((netIncome - 60000) * 5.53) / 100;
    }

  } else if (state.toLowerCase() === 'new jersey') {
    if (netIncome <= 20000) {
      taxAmount = (netIncome * 1.4) / 100;
    }
    else if (netIncome <= 35000) {
      taxAmount = (20000 * 1.4) / 100 + ((netIncome - 20000) * 1.75) / 100 - 70;
    }
    else if (netIncome <= 40000) {
      taxAmount = (20000 * 1.4) / 100 + (15000 * 1.75) / 100 - 70 + ((netIncome - 35000) * 3.5) / 100 - 682.50;
    }
    else if (netIncome <= 75000) {
      taxAmount = (20000 * 1.4) / 100 + (15000 * 1.75) / 100 - 70 + (5000 * 3.5) / 100 - 682.50 + ((netIncome - 40000) * 5.525) / 100 - 1492.50;
    }
    else if (netIncome <= 500000) {
      taxAmount = (20000 * 1.4) / 100 + (15000 * 1.75) / 100 - 70 + (5000 * 3.5) / 100 - 682.50 + (35000 * 5.525) / 100 - 1492.50 + ((netIncome - 75000) * 6.37) / 100 - 2126.25;
    }
    else if (netIncome <= 1000000) {
      taxAmount = (20000 * 1.4) / 100 + (15000 * 1.75) / 100 - 70 + (5000 * 3.5) / 100 - 682.50 + (35000 * 5.525) / 100 - 1492.50 + (425000 * 6.37) / 100 - 2126.25 + ((netIncome - 500000) * 8.97) / 100 - 15126.25;

    }
    else {
      taxAmount = (20000 * 1.4) / 100 + (15000 * 1.75) / 100 - 70 + (5000 * 3.5) / 100 - 682.50 + (35000 * 5.525) / 100 - 1492.50 + (425000 * 6.37) / 100 - 2126.25 + (500000 * 8.97) / 100 - 15126.25 + ((netIncome - 1000000) * 10.75) / 100 - 32926.25;
    }

  } else if (state.toLowerCase() === 'new mexico') {
    if (netIncome <= 10000) {
      taxAmount = 0; // No tax for income up to $10,000
    }
    else if (netIncome <= 20000) {
      taxAmount = 239; // Fixed tax for income over $10,000 and up to $20,000
    }
    else if (netIncome <= 30000) {
      taxAmount = 703; // Fixed tax for income over $20,000 and up to $30,000
    }
    else if (netIncome <= 40000) {
      taxAmount = 1193; // Fixed tax for income over $30,000 and up to $40,000
    }
    else if (netIncome <= 50000) {
      taxAmount = 1683; // Fixed tax for income over $40,000 and up to $50,000
    }
    else if (netIncome <= 60000) {
      taxAmount = 2173; // Fixed tax for income over $50,000 and up to $60,000
    }
    else if (netIncome <= 70000) {
      taxAmount = 2663; // Fixed tax for income over $60,000 and up to $70,000
    }
    else if (netIncome <= 80000) {
      taxAmount = 3153; // Fixed tax for income over $70,000 and up to $80,000
    }
    else if (netIncome <= 90000) {
      taxAmount = 3643; // Fixed tax for income over $80,000 and up to $90,000
    }
    else if (netIncome <= 96000) {
      taxAmount = 4133; // Fixed tax for income over $90,000 and up to $96,000
    }
    else if (netIncome <= 210000) {
      taxAmount = 4422 + ((netIncome - 96000) * 0.049); // Tax for income over $96,000 and up to $210,000
    }
    else {
      taxAmount = 10008 + ((netIncome - 210000) * 0.059); // Tax for income over $210,000
    }
  } else if (state.toLowerCase() === 'new york') {
    if (netIncome <= 8500) {
      taxAmount = (netIncome * 0.04); // 4% for income up to $8,500
    }
    else if (netIncome <= 11700) {
      taxAmount = 340 + ((netIncome - 8500) * 0.045); // $340 + 4.5% of the excess over $8,500
    }
    else if (netIncome <= 13900) {
      taxAmount = 484 + ((netIncome - 11700) * 0.0525); // $484 + 5.25% of the excess over $11,700
    }
    else if (netIncome <= 80650) {
      taxAmount = 600 + ((netIncome - 13900) * 0.055); // $600 + 5.5% of the excess over $13,900
    }
    else if (netIncome <= 215400) {
      taxAmount = 4271 + ((netIncome - 80650) * 0.06); // $4,271 + 6% of the excess over $80,650
    }
    else if (netIncome <= 1077550) {
      taxAmount = 12356 + ((netIncome - 215400) * 0.0685); // $12,356 + 6.85% of the excess over $215,400
    }
    else if (netIncome <= 5000000) {
      taxAmount = 71413 + ((netIncome - 1077550) * 0.0965); // $71,413 + 9.65% of the excess over $1,077,550
    }
    else if (netIncome <= 25000000) {
      taxAmount = 449929 + ((netIncome - 5000000) * 0.103); // $449,929 + 10.3% of the excess over $5,000,000
    }
    else {
      taxAmount = 2509929 + ((netIncome - 25000000) * 0.109); // $2,509,929 + 10.9% of the excess over $25,000,000
    }
  }
  else if (state.toLowerCase() === 'north carolina') {
    if (netIncome <= 10000) {
      taxAmount = (netIncome * 0.0399); // 3.99% for income up to $10,000
    }
    else if (netIncome <= 25000) {
      taxAmount = (10000 * 0.0399) + ((netIncome - 10000) * 0.0525); // $397.90 + 5.25% of the excess over $10,000
    }
    else if (netIncome <= 50000) {
      taxAmount = (10000 * 0.0399) + (15000 * 0.0525) + ((netIncome - 25000) * 0.0575); // $1,141.90 + 5.75% of the excess over $25,000
    }
    else if (netIncome <= 100000) {
      taxAmount = (10000 * 0.0399) + (15000 * 0.0525) + (25000 * 0.0575) + ((netIncome - 50000) * 0.065); // $2,489.90 + 6.50% of the excess over $50,000
    }
    else {
      taxAmount = (10000 * 0.0399) + (15000 * 0.0525) + (25000 * 0.0575) + (50000 * 0.065) + ((netIncome - 100000) * 0.0675); // $4,489.90 + 6.75% of the excess over $100,000
    }
  }
  else if (state.toLowerCase() === 'north dakota') {
    if (netIncome <= 10000) {
      taxAmount = (netIncome * 0.029); // 2.90% for income up to $10,000
    }
    else if (netIncome <= 25000) {
      taxAmount = (10000 * 0.029) + ((netIncome - 10000) * 0.039); // $290 + 3.90% of the excess over $10,000
    }
    else if (netIncome <= 50000) {
      taxAmount = (10000 * 0.029) + (15000 * 0.039) + ((netIncome - 25000) * 0.0425); // $1,290 + 4.25% of the excess over $25,000
    }
    else if (netIncome <= 100000) {
      taxAmount = (10000 * 0.029) + (15000 * 0.039) + (25000 * 0.0425) + ((netIncome - 50000) * 0.0525); // $2,290 + 5.25% of the excess over $50,000
    }
    else {
      taxAmount = (10000 * 0.029) + (15000 * 0.039) + (25000 * 0.0425) + (50000 * 0.0525) + ((netIncome - 100000) * 0.055); // $4,040 + 5.50% of the excess over $100,000
    }
  }
  else if (state.toLowerCase() === 'ohio') {
    if (netIncome <= 2500) {
      taxAmount = (netIncome * 0.019); // 1.90% for income up to $2,500
    }
    else if (netIncome <= 5000) {
      taxAmount = (2500 * 0.019) + ((netIncome - 2500) * 0.0275); // $47.50 + 2.75% of the excess over $2,500
    }
    else if (netIncome <= 10000) {
      taxAmount = (2500 * 0.019) + (2500 * 0.0275) + ((netIncome - 5000) * 0.035); // $106.25 + 3.50% of the excess over $5,000
    }
    else if (netIncome <= 25000) {
      taxAmount = (2500 * 0.019) + (2500 * 0.0275) + (5000 * 0.035) + ((netIncome - 10000) * 0.0425); // $231.25 + 4.25% of the excess over $10,000
    }
    else if (netIncome <= 50000) {
      taxAmount = (2500 * 0.019) + (2500 * 0.0275) + (5000 * 0.035) + (15000 * 0.0425) + ((netIncome - 25000) * 0.0525); // $431.25 + 5.25% of the excess over $25,000
    }
    else if (netIncome <= 100000) {
      taxAmount = (2500 * 0.019) + (2500 * 0.0275) + (5000 * 0.035) + (15000 * 0.0425) + (25000 * 0.0525) + ((netIncome - 50000) * 0.0575); // $681.25 + 5.75% of the excess over $50,000
    }
    else {
      taxAmount = (2500 * 0.019) + (2500 * 0.0275) + (5000 * 0.035) + (15000 * 0.0425) + (25000 * 0.0525) + (50000 * 0.0575) + ((netIncome - 100000) * 0.065); // $1,206.25 + 6.50% of the excess over $100,000
    }
  } else if (state.toLowerCase() === 'oklahoma') {
    if (netIncome <= 10000) {
      taxAmount = 0; // No tax for income up to $10,000
    }
    else if (netIncome <= 20000) {
      taxAmount = 310 + ((netIncome - 10000) * 0.0313); // $310 for income over $10,000
    }
    else if (netIncome <= 30000) {
      taxAmount = 810 + ((netIncome - 20000) * 0.0313); // $810 for income over $20,000
    }
    else if (netIncome <= 40000) {
      taxAmount = 1310 + ((netIncome - 30000) * 0.0313); // $1310 for income over $30,000
    }
    else if (netIncome <= 50000) {
      taxAmount = 1810 + ((netIncome - 40000) * 0.0313); // $1810 for income over $40,000
    }
    else if (netIncome <= 60000) {
      taxAmount = 2310 + ((netIncome - 50000) * 0.0313); // $2310 for income over $50,000
    }
    else if (netIncome <= 70000) {
      taxAmount = 2810 + ((netIncome - 60000) * 0.0313); // $2810 for income over $60,000
    }
    else if (netIncome <= 80000) {
      taxAmount = 3310 + ((netIncome - 70000) * 0.0313); // $3310 for income over $70,000
    }
    else if (netIncome <= 90000) {
      taxAmount = 3810 + ((netIncome - 80000) * 0.0313); // $3810 for income over $80,000
    }
    else if (netIncome <= 100000) {
      taxAmount = 4310 + ((netIncome - 90000) * 0.0313); // $4310 for income over $90,000
    }
    else {
      taxAmount = 4812 + ((netIncome - 100000) * 0.0005); // $4812 + 0.05% of the excess over $100,000
    }
  } else if (state.toLowerCase() === 'oregon') {
    if (netIncome <= 50000) {
      // Calculate the flat rate for income up to $50,000
      // Assuming a linear scale from $0 to $4,085 for this range
      taxAmount = (netIncome / 50000) * 4085;
    }
    else if (netIncome <= 125000) {
      taxAmount = 4090 + ((netIncome - 50000) * 0.0875); // $4,090 plus 8.75% of the excess over $50,000
    }
    else {
      taxAmount = 10652 + ((netIncome - 125000) * 0.099); // $10,652 plus 9.9% of the excess over $125,000
    }
  } else if (state.toLowerCase() === 'pennsylvania') {
    if (netIncome <= 3000) {
      taxAmount = netIncome * 0.0307; // 3.07% for income up to $3,000
    }
    else if (netIncome <= 7500) {
      taxAmount = (3000 * 0.0307) + ((netIncome - 3000) * 0.0335); // $92.10 + 3.35% of the excess over $3,000
    }
    else if (netIncome <= 12500) {
      taxAmount = (3000 * 0.0307) + (4500 * 0.0335) + ((netIncome - 7500) * 0.0363); // $92.10 + $150.75 + 3.63% of the excess over $7,500
    }
    else if (netIncome <= 25000) {
      taxAmount = (3000 * 0.0307) + (4500 * 0.0335) + (5000 * 0.0363) + ((netIncome - 12500) * 0.0391); // $92.10 + $150.75 + $181.50 + 3.91% of the excess over $12,500
    }
    else if (netIncome <= 50000) {
      taxAmount = (3000 * 0.0307) + (4500 * 0.0335) + (5000 * 0.0363) + (12500 * 0.0391) + ((netIncome - 25000) * 0.0419); // $92.10 + $150.75 + $181.50 + $488.75 + 4.19% of the excess over $25,000
    }
    else {
      taxAmount = (3000 * 0.0307) + (4500 * 0.0335) + (5000 * 0.0363) + (12500 * 0.0391) + (25000 * 0.0419) + ((netIncome - 50000) * 0.044); // $92.10 + $150.75 + $181.50 + $488.75 + $1047.50 + 4.40% of the excess over $50,000
    }
  } else if (state.toLowerCase() === 'rhode island') {
    if (netIncome <= 10000) {
      taxAmount = netIncome * 0.0399; // 3.99% for income up to $10,000
    }
    else if (netIncome <= 25000) {
      taxAmount = (10000 * 0.0399) + ((netIncome - 10000) * 0.0525); // $399 + 5.25% of the excess over $10,000
    }
    else if (netIncome <= 50000) {
      taxAmount = (10000 * 0.0399) + (15000 * 0.0525) + ((netIncome - 25000) * 0.0575); // $399 + $787.50 + 5.75% of the excess over $25,000
    }
    else if (netIncome <= 100000) {
      taxAmount = (10000 * 0.0399) + (15000 * 0.0525) + (25000 * 0.0575) + ((netIncome - 50000) * 0.065); // $399 + $787.50 + $1,437.50 + 6.50% of the excess over $50,000
    }
    else {
      taxAmount = (10000 * 0.0399) + (15000 * 0.0525) + (25000 * 0.0575) + (50000 * 0.065) + ((netIncome - 100000) * 0.0675); // $399 + $787.50 + $1,437.50 + $3,250 + 6.75% of the excess over $100,000
    }
  } else if (state.toLowerCase() === 'south carolina') {
    if (netIncome <= 10000) {
      taxAmount = (netIncome <= 249) ? 0 : (netIncome - 249) * (249 / 10000); // $0 to $249
    }
    else if (netIncome <= 20000) {
      taxAmount = 249 + ((netIncome - 10000) * (614 / 10000)); // $254 to $868
    }
    else if (netIncome <= 30000) {
      taxAmount = 868 + ((netIncome - 20000) * (693 / 10000)); // $875 to $1,568
    }
    else if (netIncome <= 40000) {
      taxAmount = 1568 + ((netIncome - 30000) * (693 / 10000)); // $1,575 to $2,268
    }
    else if (netIncome <= 50000) {
      taxAmount = 2268 + ((netIncome - 40000) * (693 / 10000)); // $2,275 to $2,968
    }
    else if (netIncome <= 60000) {
      taxAmount = 2968 + ((netIncome - 50000) * (693 / 10000)); // $2,975 to $3,668
    }
    else if (netIncome <= 70000) {
      taxAmount = 3668 + ((netIncome - 60000) * (693 / 10000)); // $3,675 to $4,368
    }
    else if (netIncome <= 80000) {
      taxAmount = 4368 + ((netIncome - 70000) * (693 / 10000)); // $4,375 to $5,068
    }
    else if (netIncome <= 90000) {
      taxAmount = 5068 + ((netIncome - 80000) * (693 / 10000)); // $5,075 to $5,768
    }
    else if (netIncome <= 100000) {
      taxAmount = 5768 + ((netIncome - 90000) * (693 / 10000)); // $5,775 to $6,468
    }
    else {
      taxAmount = (netIncome * 0.07) - 529; // 7% of income over $100,000 minus $529
    }
  }
  else if (state.toLowerCase() === 'utah') {
    if (netIncome <= 3000) {
      taxAmount = netIncome * 0.015; // 1.50% for income up to $3,000
    }
    else if (netIncome <= 10000) {
      taxAmount = 3000 * 0.015 + (netIncome - 3000) * 0.025; // 2.50% for income between $3,001 and $10,000
    }
    else if (netIncome <= 15000) {
      taxAmount = 3000 * 0.015 + (10000 - 3000) * 0.025 + (netIncome - 10000) * 0.035; // 3.50% for income between $10,001 and $15,000
    }
    else if (netIncome <= 30000) {
      taxAmount = 3000 * 0.015 + (10000 - 3000) * 0.025 + (15000 - 10000) * 0.035 + (netIncome - 15000) * 0.045; // 4.50% for income between $15,001 and $30,000
    }
    else if (netIncome <= 60000) {
      taxAmount = 3000 * 0.015 + (10000 - 3000) * 0.025 + (15000 - 10000) * 0.035 + (30000 - 15000) * 0.045 + (netIncome - 30000) * 0.05; // 5% for income between $30,001 and $60,000
    }
    else {
      taxAmount = 3000 * 0.015 + (10000 - 3000) * 0.025 + (15000 - 10000) * 0.035 + (30000 - 15000) * 0.045 + (60000 - 30000) * 0.05 + (netIncome - 60000) * 0.0595; // 5.95% for income over $60,000
    }
  } else if (state.toLowerCase() === 'vermont') {
    if (netIncome <= 10000) {
      taxAmount = netIncome * 0.035; // 3.50% for income up to $10,000
    }
    else if (netIncome <= 25000) {
      taxAmount = 10000 * 0.035 + (netIncome - 10000) * 0.0525; // 5.25% for income between $10,001 and $25,000
    }
    else if (netIncome <= 50000) {
      taxAmount = 10000 * 0.035 + (25000 - 10000) * 0.0525 + (netIncome - 25000) * 0.0575; // 5.75% for income between $25,001 and $50,000
    }
    else if (netIncome <= 100000) {
      taxAmount = 10000 * 0.035 + (25000 - 10000) * 0.0525 + (50000 - 25000) * 0.0575 + (netIncome - 50000) * 0.065; // 6.50% for income between $50,001 and $100,000
    }
    else {
      taxAmount = 10000 * 0.035 + (25000 - 10000) * 0.0525 + (50000 - 25000) * 0.0575 + (100000 - 50000) * 0.065 + (netIncome - 100000) * 0.0675; // 6.75% for income over $100,000
    }
  }
  else if (state.toLowerCase() === 'virginia') {
    if (netIncome <= 3000) {
      taxAmount = netIncome * 0.02; // 2% for income up to $3,000
    }
    else if (netIncome <= 5000) {
      taxAmount = (netIncome - 3000) * 0.03 + 60; // 3% for income between $3,001 and $5,000 plus $60
    }
    else if (netIncome <= 17000) {
      taxAmount = (netIncome - 5000) * 0.05 + 120; // 5% for income between $5,001 and $17,000 plus $120
    }
    else {
      taxAmount = (netIncome - 17000) * 0.0575 + 720; // 5.75% for income over $17,000 plus $720
    }
  } else if (state.toLowerCase() === 'west virginia') {
    if (netIncome <= 10000) {
      taxAmount = netIncome * 0.02; // 2% for income up to $10,000
    }
    else if (netIncome <= 25000) {
      taxAmount = (netIncome - 10000) * 0.03 + (10000 * 0.02); // 3% for income between $10,001 and $25,000
    }
    else if (netIncome <= 50000) {
      taxAmount = (netIncome - 25000) * 0.04 + (15000 * 0.03) + (10000 * 0.02); // 4% for income between $25,001 and $50,000
    }
    else if (netIncome <= 100000) {
      taxAmount = (netIncome - 50000) * 0.05 + (25000 * 0.04) + (15000 * 0.03) + (10000 * 0.02); // 5% for income between $50,001 and $100,000
    }
    else {
      taxAmount = (netIncome - 100000) * 0.06 + (50000 * 0.05) + (25000 * 0.04) + (15000 * 0.03) + (10000 * 0.02); // 6% for income over $100,000
    }
  } else if (state.toLowerCase() === 'wisconsin') {
    if (netIncome <= 13200) {
      taxAmount = netIncome * 0.04; // 4% for income up to $13,200
    }
    else if (netIncome <= 26400) {
      taxAmount = (netIncome - 13200) * 0.06 + (13200 * 0.04); // 6% for income between $13,201 and $26,400
    }
    else if (netIncome <= 49600) {
      taxAmount = (netIncome - 26400) * 0.065 + (13200 * 0.04) + (13200 * 0.06); // 6.5% for income between $26,401 and $49,600
    }
    else if (netIncome <= 99200) {
      taxAmount = (netIncome - 49600) * 0.075 + (13200 * 0.04) + (13200 * 0.06) + (23200 * 0.065); // 7.5% for income between $49,601 and $99,200
    }
    else {
      taxAmount = (netIncome - 99200) * 0.0765 + (13200 * 0.04) + (13200 * 0.06) + (23200 * 0.065) + (49600 * 0.075); // 7.65% for income over $99,200
    }
  }
  else if (state.toLowerCase() === 'wyoming') {
    if (netIncome <= 10000) {
      taxAmount = netIncome * 0.035; // 3.5% for income up to $10,000
    }
    else if (netIncome <= 25000) {
      taxAmount = (netIncome - 10000) * 0.045 + (10000 * 0.035); // 4.5% for income between $10,001 and $25,000
    }
    else if (netIncome <= 50000) {
      taxAmount = (netIncome - 25000) * 0.055 + (10000 * 0.035) + (15000 * 0.045); // 5.5% for income between $25,001 and $50,000
    }
    else if (netIncome <= 100000) {
      taxAmount = (netIncome - 50000) * 0.065 + (10000 * 0.035) + (15000 * 0.045) + (25000 * 0.055); // 6.5% for income between $50,001 and $100,000
    }
    else {
      taxAmount = (netIncome - 100000) * 0.0675 + (10000 * 0.035) + (15000 * 0.045) + (25000 * 0.055) + (50000 * 0.065); // 6.75% for income over $100,000
    }
  }
  else if (state.toLowerCase() === 'washington') {
    if (netIncome <= 10000) {
      taxAmount = netIncome * 0.04; // 4% of taxable income up to $10,000
    }
    else if (netIncome <= 40000) {
      taxAmount = 400 + (netIncome - 10000) * 0.06; // $400 + 6% of amount over $10,000
    }
    else if (netIncome <= 60000) {
      taxAmount = 2200 + (netIncome - 40000) * 0.065; // $2,200 + 6.5% of amount over $40,000
    }
    else if (netIncome <= 250000) {
      taxAmount = 3500 + (netIncome - 60000) * 0.085; // $3,500 + 8.5% of amount over $60,000
    }
    else if (netIncome <= 500000) {
      taxAmount = 19650 + (netIncome - 250000) * 0.0925; // $19,650 + 9.25% of amount over $250,000
    }
    else if (netIncome <= 1000000) {
      taxAmount = 42775 + (netIncome - 500000) * 0.0975; // $42,775 + 9.75% of amount over $500,000
    }
    else {
      taxAmount = 91525 + (netIncome - 1000000) * 0.1075; // $91,525 + 10.75% of amount over $1,000,000
    }
  }
  else if (state.toLowerCase() === 'nevada' || "new hampshire" || "south dakota" || "tennessee" || "texas") {
    taxAmount = 0; // Nevada & new hampshire has no state income tax

  }
  else {
    return res.status(404).json({ error: "State not found." });
  }

  res.json({ tax: taxAmount.toFixed(2), state, income });
});














//BALANCE SHEET
// GET Balance Sheet API with Totals
server.get("/balance-sheet/:id", verifyJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch all transactions for the user with populated references
    const transactions = await TransactionModel.find({ user_id: userId })
      .populate("MainCategoryID", "MainCategory")
      .populate("SubCategoryName.SubCategoryID", "name")
      .populate("AccountID", "AccountType")
      .populate("AccountName.AccountID", "Name");

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ success: false, message: "No transactions found." });
    }

    // Helper function to calculate totals for grouped categories
    const calculateTotal = (transactions, type) => {
      return transactions.reduce((sum, transaction) => {
        return transaction.TransactionType === type ? sum + transaction.Amount : sum;
      }, 0);
    };

    // Balance Sheet Structure
    const balanceSheet = {
      assets: {
        current_assets: [],
        total_current_assets: 0,
        fixed_assets: [],
        total_fixed_assets: 0,
        non_current_assets: [],
        total_non_current_assets: 0,
        total_assets: 0,
      },
      liabilities: {
        current_liabilities: [],
        total_current_liabilities: 0,
        non_current_liabilities: [],
        total_non_current_liabilities: 0,
        total_liabilities: 0,
      },
      equity: [],
      total_owner_equity: 0,
      total_liabilities_and_owner_equity: 0,
    };

    // Group transactions by category and populate balance sheet
    transactions.forEach((transaction) => {
      const { MainCategoryID, CategoryType, SubCategoryName, Amount } = transaction;

      switch (MainCategoryID.MainCategory) {
        case "Asset":
          if (CategoryType === "Current Asset") {
            balanceSheet.assets.current_assets.push({
              name: SubCategoryName.name,
              amount: Amount,
            });
            balanceSheet.assets.total_current_assets += Amount;
          } else if (CategoryType === "Fixed Asset") {
            balanceSheet.assets.fixed_assets.push({
              name: SubCategoryName.name,
              amount: Amount,
            });
            balanceSheet.assets.total_fixed_assets += Amount;
          } else {
            balanceSheet.assets.non_current_assets.push({
              name: SubCategoryName.name,
              amount: Amount,
            });
            balanceSheet.assets.total_non_current_assets += Amount;
          }
          balanceSheet.assets.total_assets += Amount;
          break;

        case "Liability":
          if (CategoryType === "Current Liability") {
            balanceSheet.liabilities.current_liabilities.push({
              name: SubCategoryName.name,
              amount: Amount,
            });
            balanceSheet.liabilities.total_current_liabilities += Amount;
          } else {
            balanceSheet.liabilities.non_current_liabilities.push({
              name: SubCategoryName.name,
              amount: Amount,
            });
            balanceSheet.liabilities.total_non_current_liabilities += Amount;
          }
          balanceSheet.liabilities.total_liabilities += Amount;
          break;

        case "Equity":
          balanceSheet.equity.push({
            name: SubCategoryName.name,
            amount: Amount,
          });
          balanceSheet.total_owner_equity += Amount;
          break;

        default:
          break;
      }
    });

    // Calculate total liabilities and equity
    balanceSheet.total_liabilities_and_owner_equity =
      balanceSheet.liabilities.total_liabilities + balanceSheet.total_owner_equity;

    res.status(200).json({
      success: true,
      balance_sheet: balanceSheet,
    });
  } catch (error) {
    console.error("Error in fetching balance sheet:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});










//Logout Route For sent token in headers
server.post('/logout', async (req, res) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(400).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'Tirtho'); // Use the same secret key as in the login
    const expirationDate = new Date(decoded.exp * 1000);

    // Add the token to the blacklist
    await BlacklistedTokenModel.create({
      token,
      expiresAt: expirationDate,
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});








//SERVER
//server running
server.listen(3500, async () => {
  try {
    await connect;
    console.log("mongoDb connected");
  } catch (error) {
    console.log(error);
  }
  console.log(`server running at port 3500`);
});


