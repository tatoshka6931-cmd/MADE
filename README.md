Here's a list of things to complete in order to get a full working submission processing pipeline.

1. Create an airtable database according to the AIRTABLE_SETUP.md guide - already completed (Search for Rae's Base in the Wond'ry account)
2. Create a github repository and transfer all the code files from this repo into it.
   Ensure the file structure is kept: project.js, student.js, upload.js are under the api folder; .vscode folder contains settings.json
3. go to vercel.com, create an account and connect it to your github repo. The easiest way is to sign up with your guthub account
4. In vercel go to environment variables and create 2 variables:
   AIRTABLE_API_KEY = enter your api key
   AIRTABLE_BASE_ID = enter base id
5. Create the website deployment
6. if the url of the deployment changes, make sure to regenerate a qr code and reprint the poster.
