const THUMBNAIL_MAX_HEIGHT = 400; // 画像がタテ長の場合、縦サイズがこの値になるように縮小される
const THUMBNAIL_MAX_WIDTH = 400; // 画像がヨコ長の場合、横サイズがこの値になるように縮小される
const THUMBNAIL_ROW_COUNT = 4;

$(function () {
    // ファイルが選択されたら実行される関数
    $('input[type=file]').change(loadImagesToCanvas);
    
    // アップロードボタンがクリックされたら実行される関数
    $('#upload').click(async function () {
        const childContainerElements = document.getElementsByClassName('child-container');

        // ファイルが指定されていなければ何も起こらない
        if (childContainerElements.length === 0) {
            return;
        }

        // 送信するフォームデータを作成する
        //const formData = new FormData();

        const postData = [];
        // 先ほど作った縮小済画像データを添付する
        Array.from(childContainerElements).map(childContainerElement => {
            const fileName = childContainerElement.getAttribute('id');
            const canvasElement = childContainerElement.getElementsByTagName('canvas')[0];
            postData.push({'fileName': fileName, 'imageFile': createBase64OfImage(canvasElement)});
            // keyの末尾に[]をつけると、要素が一つでもリストとして認識される
            //formData.append('imageFiles[]', createBase64OfImage(canvasElement), fileName);
        });

        let response = await fetch('https://zealous-clarke-150253.netlify.app/.netlify/functions/server', {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(postData)
        });

        console.log('response:', response);
        let resultJsons = await response.json();

        console.log('result:', resultJsons);

        resultJsons.forEach(resultJson => {
            createPredictResult(resultJson);
        });
    });
});

// ダイアログで選択されたファイルを返す
function getSelectedImageFiles() {
    return $('#file').prop('files');
}

function loadImagesToCanvas() {
    // ファイルを取得する    
    // 選択されたファイルが画像かどうか判定する
    // ここでは、jpeg形式とpng形式のみを画像をみなす
    const imageFiles = Array.from(getSelectedImageFiles()).filter( file => {
        return file.type === 'image/jpeg' || file.type === 'image/png';
    });

    if ( imageFiles.length === 0 ) {
        return;
    }
    
    const canvasContainerElement = createContainerGridElement(imageFiles.length);
    
    const contentElement = document.getElementById('content');
    removeChildElements(contentElement);
    contentElement.appendChild(canvasContainerElement);

    const childContainerElements = Array.from(document.getElementsByClassName('child-container'));
    imageFiles.forEach((imageFile, index)=> {
        // TODO エスケ＝ぷ？
        const childContainerElement = childContainerElements[index];
        childContainerElement.setAttribute('id', imageFile.name);
        
        const canvasElement = childContainerElement.getElementsByTagName('canvas')[0];
        //canvasElement.setAttribute('class', imageFile.name);
        loadImageToCanvas(imageFile, canvasElement);
    });
}

function createContainerGridElement(elementCount) {
    // 0-4は1行、5-8は2行
    const rowCount = Math.min(1, elementCount % THUMBNAIL_ROW_COUNT) + elementCount / THUMBNAIL_ROW_COUNT;
    // 一行の最大は４に設定
    const columnCount = Math.min(THUMBNAIL_ROW_COUNT, elementCount);

    const canvasContainerElement = document.createElement('div');
    canvasContainerElement.setAttribute('id', 'container');
    canvasContainerElement.style['grid-template-rows'] = '450px '.repeat(rowCount);
    canvasContainerElement.style['grid-template-columns'] = '450px '.repeat(columnCount);

    // TODO 無駄にgridつくっている
    for (let row = 1; row <= rowCount; row++) {
        for (let column = 1; column <= columnCount; column++) {
            const divElement = document.createElement('div');
            divElement.setAttribute('class', 'child-container')
            divElement.style['grid-row'] = `${row} / ${row + 1}`;
            divElement.style['grid-column'] = `${column} / ${column + 1}`;

            const canvasElement = document.createElement('canvas');
            divElement.appendChild(canvasElement);

            canvasContainerElement.appendChild(divElement);
        }
    }
    return canvasContainerElement;
}

function loadImageToCanvas(imageFile, canvasElement) {
    const image = new Image();
    const reader = new FileReader();

    reader.readAsDataURL(imageFile);
    reader.onload = function (evt) {
        image.src = evt.target.result;
        image.onload = function () {
            const { width, height } = calcImageSize(image);

            // 縮小画像を描画するcanvasのサイズを上で算出した値に変更する
            canvasElement.width = width;
            canvasElement.height = height;

            const ctx = canvasElement.getContext('2d');

            // canvasに既に描画されている画像があればそれを消す
            // Elementごと消しているので不要（メモリは不明）
            //ctx.clearRect(0, 0, width, height);

            // canvasに縮小画像を描画する
            ctx.drawImage(image,
                0, 0, image.width, image.height,
                0, 0, width, height
            );
        }
    }
}

/**
 * 渡された要素の子要素をすべて削除する
 * @param {element} parentElement 
 */
function removeChildElements(parentElement) {
    while (parentElement.firstChild) {
        parentElement.removeChild(parentElement.firstChild);
    }
}

// リサイズ後の画像サイズを計算
function calcImageSize(image) {
    let width, height;
    if (image.width > image.height) {
        // ヨコ長の画像は横サイズを定数にあわせる
        const ratio = image.height / image.width;
        width = THUMBNAIL_MAX_WIDTH;
        height = THUMBNAIL_MAX_WIDTH * ratio;
    } else {
        // タテ長の画像は縦のサイズを定数にあわせる
        const ratio = image.width / image.height;
        width = THUMBNAIL_MAX_HEIGHT * ratio;
        height = THUMBNAIL_MAX_HEIGHT;
    }

    return { width, height };
}


// canvasに表示されている画像をblobとして取得する
function createBlobOfImage(canvasElement) {
    // canvasから画像をbase64として取得する
    const base64 = canvasElement.toDataURL('image/jpeg');

    // base64から画像データを作成する
    // toDataURLの戻り値は、data:image/png;base64,~~なので、~~の部分だけを取得する
    // atobの戻り値はstring(元がimageのbinaryなので、0-255(1byte)の整数)
    const decodeBase64Image = atob(base64.split('base64,')[1]);
    const imageSize = decodeBase64Image.length;
    // Uint8Array = 0-255の整数の配列
    const byteArray = new Uint8Array(imageSize);
    for (let i = 0; i < imageSize; i++) {
        // 0-255の範囲の文字列を0-255の整数=codepointになおす
        byteArray[i] = decodeBase64Image.charCodeAt(i);
    }

    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    return blob;
}

function createBase64OfImage(canvasElement) {
    const base64 = canvasElement.toDataURL('image/jpeg');
    return base64.split('base64,')[1];
}


function createPredictResult(resultJson) {
    const divElementForName = document.createElement('div');
    const labelElement = document.createElement('label');
    labelElement.textContent = '認識結果: ';

    const inputElement = document.createElement('input');
    inputElement.value = resultJson.name;

    divElementForName.appendChild(labelElement);
    divElementForName.appendChild(inputElement);

    const divElementForScore = document.createElement('div');
    const scoreLabelElement = document.createElement('label');
    scoreLabelElement.textContent = `score: ${resultJson.score}`;
    if (resultJson.score <= 0.7) {
        labelElement.color = 'red';
    }
    divElementForScore.appendChild(scoreLabelElement);

    const childContainerElement = document.getElementById(resultJson.fileName);
    childContainerElement.appendChild(divElementForName);
    childContainerElement.appendChild(divElementForScore);
}