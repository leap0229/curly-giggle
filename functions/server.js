const http = require('http');
const fs = require('fs').promises;
const multipart = require('connect-multiparty');
const { PredictionServiceClient } = require('@google-cloud/automl');

const projectId = 'red-plate-137112';
const location = 'us-central1';
const modelId = 'ICN2318652319677284352';
const client = new PredictionServiceClient({ 
    credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY.split("\\n").join("\n")
    }
});

exports.handler = async (event, context) => {
    //console.log('event:', JSON.parse(event.body));
    const imageFiles = JSON.parse(event.body);
    const predictPromises = imageFiles.map(async imageFile => {
        const content = Buffer.from(imageFile.imageFile, 'base64');
        const predictResult = await predict(content);

        if (predictResult.name == '') {
            predictResult.name = '認識失敗';
            predictResult.score = 0;
        }
    
        predictResult.fileName = imageFile.fileName;

        return predictResult;
    });

    console.log('predictPromises:', predictPromises);
    const predictResults = await Promise.all(predictPromises);
    //res.json(predictResults);
    console.log('predictResults:', predictResults);

    return {
      statusCode: 200,
      body: JSON.stringify(predictResults),
      headers: {'Access-Control-Allow-Origin': '*'}
    }
  }
  

/**
 * ファイルのバイナリを引数として、GCPのAutomlにリクエストを投げ、予測結果を返す
 * @param {file} content 予測対象のファイルバイナリ 
 */
async function predict(content) {
    const request = {
        name: client.modelPath(projectId, location, modelId),
        payload: {
            image: {
                imageBytes: content
            }
        }
    };

    const [response] = await client.predict(request);

    const predictResult = {name: "", score: ""};
    // TODO 予測できなかった場合、[]が返ってくる
    for (const annotationPayload of response.payload) {
        predictResult.name = annotationPayload.displayName;
        predictResult.score = annotationPayload.classification.score;
    }

    return predictResult;
}


async function predict_stab(content) {
    return { name: 'stab', score: 0.999};
}