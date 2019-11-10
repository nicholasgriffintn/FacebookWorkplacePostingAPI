var request = require("request");
const AWS = require("aws-sdk");

var Raven = require('raven');
Raven.config('https://2a9bdf71dc3e48439ef9a022fe965519@sentry.accropress.com/7').install();

AWS.config.setPromisesDependency(require("bluebird"));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const submitAdvertP = advert => {
  console.log("Submitting advert to db");
  const advertInfo = {
    TableName: process.env.ADVERTS_TABLE,
    Item: {
		"id" : advert
	}
  };
  return dynamoDb
    .put(advertInfo)
    .promise()
    .then(res => advert);
};

var postNewArticle = function(jobPostingEndURL, facebookAccessToken) {
  // Set the URL
  var url =
    "https://sf.vacancy-filler.co.uk" +
    "/CareerPage/GetResultList?" +
    jobPostingEndURL +
    "&sortBy=postingdate";

  console.log("url:" + url);

  // Make the request
  request(
    {
      url: url,
      json: true
    },
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        let advertListBody = body;
		console.log("Retrieved Adverts" + advertListBody);
		

        advertListBody.forEach(function(advert) {
          const params = {
            TableName: process.env.ADVERTS_TABLE,
            Key: {
				id: advert
            }
          };

          dynamoDb
            .get(params)
            .promise()
            .then(result => {
			  if (!result.Item) {
				console.log("Getting advert:" + advert);
				
				submitAdvertP(advert);
  
				var advertUrl =
				  "https://sf.vacancy-filler.co.uk/CareerPage/GetItem?id=" +
				  advert;
				request(
				  {
					url: advertUrl,
					json: true
				  },
				  function(error, response, body) {
					let postBody = body;
					console.log("Retrieved Advert: " + advertBody.Id);
  
					// Remove empty elements
					let verifiedAdvertBody = new Object({});
					if (postBody.Id == "") {
					  verifiedAdvertBody.Id = "null";
					} else {
					  verifiedAdvertBody.Id = advertBody.Id;
					}
  
					// Build the JSON Array
					var retrievedAdvertArray = {
					  originalID: verifiedAdvertBody.Id
					};
  
					// Send the data to facebook
					request.post(
					  "https://graph.facebook.com/v3.0/group/feed",
					  {
						json: {
						  message:
							"New job posted: ",
						  access_token: facebookAccessToken
						}
					  },
					  (error, res, body) => {
						if (error) {
						  console.error(error);
						  return;
						}
  
						console.log(`statusCode: ${res.statusCode}`);
						console.log(body);
					  }
					);
				  }
				);
			  } else {
				console.log('Found advert in DB, wont post')
			  }
            })
            .catch(error => {
				Raven.captureException(error);
            });
        });
      }
    }
  );
};

module.exports.run = (event, context) => {
	const requestBody = event.body;

	postNewArticle(
		requestBody.getResultListEnd,
		requestBody.facebookAccessToken
	);
};
