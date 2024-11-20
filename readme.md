# User Registration API

## Overview

This API endpoint allows users to register by providing their personal information. It checks for duplicate email addresses, hashes the password for security, and stores the user's data in the database.

## Endpoint

### POST /registeruser

**Description**: Registers a new user by creating a new entry in the `RegisteruserModel` collection.

**Request Body**:
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "password": "string",
  "UserType": "string",
  "BusinessType": "string",
  "BusinessCategories": "string"
}



# User Login API

## Overview

This API endpoint allows users to log in by providing their email and password. It checks if the provided credentials match the ones in the database, and if so, generates a JWT token for authentication.

## Endpoint

### POST /loginuser

**Description**: Logs in a user by verifying their email and password. If successful, it returns a JWT token for authenticated access.

**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}



# User Profile API

## Overview

This API endpoint allows for the creation or updating of a user's profile. It manages the `UserporfileModel` CMS, which includes user details such as address, currency, and fiscal year.

## Endpoint

### POST /userprofile

**Description**: Creates a new user profile or updates an existing one. The user must be authenticated with a valid JWT token.

**Request Body**:
```json
{
  "user_id": "string",
  "address": "string",
  "currency": "string",
  "fiscal_year": "string"
}




# Get User Profile API

## Overview

This API endpoint retrieves the profile information of a user by their ID. It populates the user profile data and returns it in the response.

## Endpoint

### GET /userprofile/:id

**Description**: Retrieves the user profile data for a specified user ID. The user must be authenticated with a valid JWT token.

**Path Parameters**:
- `id` (string): The unique identifier of the user whose profile data is to be retrieved.

**Responses**:

- **200 OK**:
  ```json
  {
    "userprofile": {
      "user_id": "string",
      "address": "string",
      "currency": "string",
      "fiscal_year": "string"
    }
  }



# Get All User Profiles API

## Overview

This API endpoint retrieves all user profiles from the database. It returns a list of user profiles.

## Endpoint

### GET /all-userprofile

**Description**: Retrieves all user profiles stored in the `UserporfileModel` collection.

**Responses**:

- **200 OK**:
  ```json
  [
    {
      "user_id": "string",
      "address": "string",
      "currency": "string",
      "fiscal_year": "string"
    },
    ...
  ]


# Bank Setup API

## Overview

This API endpoint allows users to set up their bank account information. It validates the user, creates a new bank setup entry, and links it to the user's profile.

## Endpoint

### POST /bank-setup

**Description**: Creates a new bank setup entry for a user and links it to their profile. The user must be authenticated with a valid JWT token.

**Request Body**:
```json
{
  "user_id": "string",
  "bank_account": "string",
  "bank_type": "string",
  "account_number": "string",
  "opening_balance": "number"
}


# Get Bank Setup API

## Overview

This API endpoint retrieves the bank setup information for a user by their ID. It populates the bank setup data and returns it in the response.

## Endpoint

### GET /bank-setup/:id

**Description**: Retrieves the bank setup data for a specified user ID. The user must be authenticated with a valid JWT token.

**Path Parameters**:
- `id` (string): The unique identifier of the user whose bank setup data is to be retrieved.

**Responses**:

- **200 OK**:
  ```json
  [
    {
      "_id": "string",
      "user_id": "string",
      "bank_account": "string",
      "bank_type": "string",
      "account_number": "string",
      "opening_balance": "number"
    },
    ...
  ]


# Update Bank Setup API

## Overview

This API endpoint allows users to update their bank setup information. It updates the bank account details for a specified bank setup ID and returns the updated bank setup data.

## Endpoint

### PUT /bank-setup/:id

**Description**: Updates the bank setup data for a specified ID. The user must be authenticated with a valid JWT token.

**Path Parameters**:
- `id` (string): The unique identifier of the bank setup to be updated.

**Request Body**:
```json
{
  "bank_account": "string",
  "bank_type": "string",
  "account_number": "string",
  "opening_balance": "number"
}


# Delete Bank Setup API

## Overview

This API endpoint allows users to delete their bank setup information. It removes a specified bank setup entry and updates the user's records accordingly.

## Endpoint

### DELETE /bank-setup/:id

**Description**: Deletes the bank setup data for a specified ID. The user must be authenticated with a valid JWT token and must be authorized to delete the bank setup.

**Path Parameters**:
- `id` (string): The unique identifier of the bank setup to be deleted.

**Responses**:

- **200 OK**:
  ```json
  {
    "message": "Bank setup deleted successfully"
  }



# Category Setup API

## Overview

This API endpoint allows users to create a new category setup. It adds a new category and its associated sub-categories for a user and returns the created category setup data.

## Endpoint

### POST /category-setup

**Description**: Creates a new category setup entry and associates it with a user. The user must be authenticated with a valid JWT token.

**Request Body**:
```json
{
  "user_id": "string",
  "category": "string",
  "sub_category": [
    "string"
  ]
}


# Get Category Setup Data API

## Overview

This API endpoint retrieves the category setup data for a specified user. It returns the categories and sub-categories associated with the user.

## Endpoint

### GET /category-setup/:id

**Description**: Retrieves the category setup data for a specified user. The user must be authenticated with a valid JWT token.

**Path Parameters**:
- `id` (string): The unique identifier of the user whose category setup data is to be retrieved.

**Responses**:

- **200 OK**:
  ```json
  [
    {
      "_id": "string",
      "user_id": "string",
      "category": "string",
      "sub_category": [
        "string"
      ],
      "__v": "number"
    }
  ]


# Update Category Setup API

## Overview

This endpoint updates an existing category setup entry for a specific user. It allows modification of the category and sub-category details.

## Endpoint

### PUT /category-setup/:id

**Description**: Updates the category setup data for a specified entry. The user must be authenticated with a valid JWT token.

**Path Parameters**:
- `id` (string): The unique identifier of the category setup entry to be updated.

**Request Body**:
```json
{
  "category": "string",
  "sub_category": [
    "string"
  ]
}

# Delete Category Setup API

## Overview

This endpoint deletes an existing category setup entry by its ID. It also removes the reference from the user's `categorysetup` array.

## Endpoint

### DELETE /category-setup/:id

**Description**: Deletes a category setup entry identified by the specified ID and updates the user's `categorysetup` array to remove the reference.

**Path Parameters**:
- `id` (string): The unique identifier of the category setup entry to be deleted.

**Responses**:

- **200 OK**:
  ```json
  {
    "message": "Category setup deleted successfully"
  }


# Add Sub-Categories to a Category Setup API

## Overview

This endpoint adds one or more sub-categories to an existing category setup entry identified by its ID.

## Endpoint

### POST /category-setup/:id/sub-categories

**Description**: Adds sub-categories to the specified category setup entry. If the category setup exists, new sub-categories are appended to the existing list.

**Path Parameters**:
- `id` (string): The unique identifier of the category setup entry to which sub-categories will be added.

**Request Body**:
- `sub_category` (array): An array of sub-category names to be added to the category setup.

**Responses**:

- **200 OK**:
  ```json
  {
    "category": "Main Category",
    "sub_category": ["Sub1", "Sub2", "Sub3"],
    "user_id": {
      "name": "User Name",
      "email": "user@example.com"
    }
  }


# Delete a Specific Sub-Category API

## Overview

This endpoint deletes a specific sub-category from an existing category setup entry identified by the sub-category ID.

## Endpoint

### DELETE /category-setup/sub-category/:subCategoryId

**Description**: Deletes a sub-category identified by its ID from the category setup. If the sub-category exists, it is removed from the category setup's sub-category list.

**Path Parameters**:
- `subCategoryId` (string): The unique identifier of the sub-category to be deleted.

**Responses**:

- **200 OK**:
  ```json
  {
    "category": "Main Category",
    "sub_category": ["Sub1", "Sub2"], // Updated list without the deleted sub-category
    "user_id": {
      "name": "User Name",
      "email": "user@example.com"
    }
  }



# Account Setup API

## Overview

This endpoint creates a new account setup entry for a user, including basic categories, category types, bank account details, and transactions.

## Endpoint

### POST /account-setup

**Description**: Creates a new account setup entry. If successful, the new account setup is linked to the specified user and populated with user information.

**Request Body**:

- `user_id` (string): The unique identifier of the user for whom the account setup is being created.
- `basic_categories` (string): The basic category for the account setup. Valid values are `'Income'`, `'Expense'`, `'Transfer'`, `'Assets'`, or `'Liabilities'`. Defaults to `'Income'` if not provided or invalid.
- `category_type` (string): Type of category for the account setup.
- `sub_category_type` (string): Type of sub-category for the account setup.
- `bank_account` (string): Bank account details associated with the account setup.
- `bank_to` (string): Additional bank information (e.g., bank name or branch) associated with the account setup.
- `transaction` (array): An array of transaction objects. Each transaction object should have:
  - `type` (string): Transaction type. Must be either `'Credit'` or `'Debit'`.
  - `amount` (number): The amount of the transaction. Must be a positive number.
- `createdAt` (string, optional): The creation date of the account setup in ISO format.

**Responses**:

- **201 Created**:
  ```json
  {
    "_id": "accountsetup_id",
    "user_id": {
      "name": "User Name",
      "email": "user@example.com"
    },
    "basic_categories": "Income",
    "category_type": "Type",
    "sub_category_type": "Sub-type",
    "bank_account": "Bank Account Details",
    "bank_to": "Additional Bank Info",
    "transaction": [
      {
        "type": "Credit",
        "amount": 100
      },
      {
        "type": "Debit",
        "amount": 50
      }
    ],
    "createdAt": "2024-08-30T12:00:00Z"
  }



# Account Setup API

## Overview

This endpoint retrieves the account setup information for a specified user, including details of all associated account setups.

## Endpoint

### GET /account-setup/:id

**Description**: Retrieves the account setup information for a user by their ID. This includes details of all account setups linked to the user.

**Path Parameters**:

- `id` (string): The unique identifier of the user for whom the account setup information is being requested.

**Responses**:

- **200 OK**:
  ```json
  [
    {
      "_id": "accountsetup_id1",
      "user_id": {
        "name": "User Name",
        "email": "user@example.com"
      },
      "basic_categories": "Income",
      "category_type": "Type",
      "sub_category_type": "Sub-type",
      "bank_account": "Bank Account Details",
      "bank_to": "Additional Bank Info",
      "transaction": [
        {
          "type": "Credit",
          "amount": 100
        },
        {
          "type": "Debit",
          "amount": 50
        }
      ],
      "createdAt": "2024-08-30T12:00:00Z"
    },
    ...
  ]


# Account Setup Details API

## Overview

This endpoint retrieves detailed information about a specific account setup by its ID, including associated user information.

## Endpoint

### GET /account-setup/details/:accountSetupId

**Description**: Retrieves detailed information about an account setup by its ID. This includes user information and all details related to the specified account setup.

**Path Parameters**:

- `accountSetupId` (string): The unique identifier of the account setup.

**Responses**:

- **200 OK**:
  ```json
  {
    "_id": "accountsetup_id",
    "user_id": {
      "name": "User Name",
      "email": "user@example.com"
    },
    "basic_categories": "Income",
    "category_type": "Type",
    "sub_category_type": "Sub-type",
    "bank_account": "Bank Account Details",
    "bank_to": "Additional Bank Info",
    "transaction": [
      {
        "type": "Credit",
        "amount": 100
      },
      {
        "type": "Debit",
        "amount": 50
      }
    ],
    "createdAt": "2024-08-30T12:00:00Z"
  }


# Account Setup Update API

## Overview

This endpoint updates an existing account setup by its ID. It allows modifications to various fields such as `basic_categories`, `category_type`, `sub_category_type`, `transaction`, `bank_account`, and `bank_to`.

## Endpoint

### PUT /account-setup/:id

**Description**: Updates an existing account setup by its ID. This includes updating categories, transaction details, bank account information, and other fields.

**Path Parameters**:

- `id` (string): The unique identifier of the account setup to be updated.

**Request Body**:

```json
{
  "user_id": "user_id",
  "basic_categories": "Income",
  "category_type": "Type",
  "sub_category_type": "Sub-type",
  "transaction": [
    {
      "type": "Credit",
      "amount": 100
    },
    {
      "type": "Debit",
      "amount": 50
    }
  ],
  "bank_account": "Bank Account Details",
  "bank_to": "Additional Bank Info",
  "updatedAt": "2024-08-30T12:00:00Z"
}


# Account Setup Delete API

## Overview

This endpoint allows you to delete an existing account setup by its ID. It ensures that the user has the necessary permissions to delete the specified account setup and removes all references to it from the user's account.

## Endpoint

### DELETE /account-setup/:id

**Description**: Deletes an existing account setup by its ID. This operation also removes the reference to the account setup from the associated user's account.

**Path Parameters**:

- `id` (string): The unique identifier of the account setup to be deleted.

**Request Body**:

```json
{
  "user_id": "user_id"
}


# Add Transaction API

## Overview

This endpoint allows you to add one or more transactions to a specific account setup. It validates the user and account setup, checks transaction data, and updates the account setup with the new transactions.

## Endpoint

### POST /add-transaction

**Description**: Adds one or more transactions to a specified account setup. Validates transactions before adding them.

**Request Body**:

```json
{
  "user_id": "user_id",
  "accountsetup_id": "accountsetup_id",
  "transaction": [
    {
      "type": "Credit",          // or "Debit"
      "amount": 100.00,
      "transaction_date": "2024-08-30T14:00:00Z"
    }
    // Additional transactions can be included
  ]
}


# Update Transaction API

## Overview

This endpoint allows you to update a specific transaction within an account setup. It validates the user and account setup, checks the transaction's existence, and updates the transaction data.

## Endpoint

### POST /update-transaction

**Description**: Updates a specific transaction within an account setup. Validates and updates the transaction details before saving.

**Request Body**:

```json
{
  "user_id": "user_id",
  "accountsetup_id": "accountsetup_id",
  "transaction_id": "transaction_id",
  "updatedTransaction": {
    "type": "Credit",           // or "Debit"
    "amount": 150.00,
    "date": "2024-08-30T14:00:00Z"  // Optional, if not provided, existing date will be used
  }
}


# Delete Transaction API

## Overview

This endpoint allows you to delete a specific transaction from an account setup. It verifies the user and account setup, ensures the transaction exists, and then removes it from the account setup.

## Endpoint

### DELETE /delete-transaction

**Description**: Deletes a specific transaction from an account setup. Validates and removes the transaction before saving the updated account setup.

**Request Body**:

```json
{
  "user_id": "user_id",
  "accountsetup_id": "accountsetup_id",
  "transaction_id": "transaction_id"
}










# Logout API

## Overview

This endpoint allows users to log out by blacklisting their JWT token. The token is added to a blacklist to prevent further use.

## Endpoint

### POST /logout

**Description**: Logs out a user by blacklisting the provided JWT token. The token is stored with its expiration date to prevent further use.

**Request Headers**:

- `Authorization` (string): The JWT token to be blacklisted. It should be provided in the `Authorization` header.

**Request Body**:

- No request body is required.

**Responses**:

- **200 OK**:
  ```json
  {
    "message": "Logged out successfully"
  }
