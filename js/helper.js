
/**
 * Function that draw the border of the canvas
 * @param canvasWidth
 * @param canvasHeight
 * @param context - the context of the canvas
 */
function drawCanvasBorder(canvasWidth, canvasHeight, context) {
    context.fillStyle = '#0093c4';

    //drawing the border
    context.beginPath();
    context.fillRect(0, 0, canvasWidth, canvasBorderSpace);
    context.fillRect(0, 0, canvasBorderSpace, canvasHeight);
    context.fillRect(0, canvasHeight - canvasBorderSpace, canvasWidth, canvasBorderSpace);
    context.fillRect(canvasWidth - canvasBorderSpace, 0, canvasWidth, canvasHeight);
    context.stroke();
}

/**
 * Function that encodes the request to be sent to the server in a json object
 * @param action - the type of the request
 * @param data - the data of the request
 * @returns {string} - json object with the encoded request
 */
function encodeRequest(action, data) {
    return JSON.stringify({action: action, data: data});
}

function encodeRequestWithId(id, action, data) {
    return JSON.stringify({id: id, action: action, data: data});
}

function parseResponse(response) {
    return JSON.parse(response.data);
}

/**
 * Function that draws the grid on the canvas
 * @param canvasWidth
 * @param canvasHeight
 * @param context
 * @param spacing
 * @param floorWidth
 * @param direction
 */
function drawDashedLine(canvasWidth, canvasHeight, context, spacing, floorWidth, direction) {
    let virtualWidth    = scaleSize(floorWidth, canvasWidth) * spacing;
    context.strokeStyle = 'lightgray';

    if (direction === 'horizontal') {
        for (let i = canvasBorderSpace; i < canvasHeight - canvasBorderSpace; i += virtualWidth) {
            context.beginPath();
            context.setLineDash(canvasGridPattern);
            context.moveTo(canvasBorderSpace, i);
            context.lineTo(canvasWidth - canvasBorderSpace, i);
            context.stroke();
        }
    } else if (direction === 'vertical') {
        for (let i = canvasBorderSpace; i < canvasWidth - canvasBorderSpace; i += virtualWidth) {
            context.beginPath();
            context.setLineDash(canvasGridPattern);
            context.moveTo(i, canvasBorderSpace);
            context.lineTo(i, canvasHeight - canvasBorderSpace);
            context.stroke();
        }
    }
    context.closePath();
}

/**
 * Function that clear the canvas and redraw the background and the border
 * @param canvasWidth
 * @param canvasHeight
 * @param context
 * @param image
 */
function updateCanvas(canvasWidth, canvasHeight, context, image) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    if (image !== undefined) {
        context.drawImage(image, 0, 0);
        context.stroke();
    }

    drawCanvasBorder(canvasWidth, canvasHeight, context);
}


/**
 * Function that draw an image on the canvas
 * @param value - informations of the object to be drawn
 * @param context
 * @param img
 * @param width
 * @param canvasWidth
 * @param canvasHeight
 * @param isTag - true if the object to be drawn is a tag
 */
function drawIcon(value, context, img, width, canvasWidth, canvasHeight, isTag) {
    let id         = 0;
    let realHeight = (width * canvasHeight) / canvasWidth;

    let virtualRadius = scaleSize(width, canvasWidth) * value.radius;
    let virtualTag    = scaleIconSize(value.x_pos, value.y_pos, width, realHeight, canvasWidth, canvasHeight);

    context.beginPath();
    if (isTag) {
        context.fillStyle = 'red';
        context.fillText(value.name, virtualTag.width - 10, virtualTag.height - 14);
    } else {
        context.fillStyle = '#0093c4';
        id = value.name;
        context.fillText(id, virtualTag.width - 17, virtualTag.height - 15);
    }

    context.drawImage(img, virtualTag.width - 10, virtualTag.height - 10);
    context.strokeStyle = '#ff000015';
    context.stroke();
    if (value.radius > 0) {
        context.beginPath();
        context.setLineDash([]);
        context.arc(virtualTag.width + 5, virtualTag.height - 6, virtualRadius, 0, 2 * Math.PI);
        context.fillStyle = '#ff000009';
        context.fill();
        context.stroke();
    }
    context.closePath();
}

/**
 * Function that draws the icon of a cloud of tags
 * @param value - the informations of a tha inside the cloud
 * @param context
 * @param img
 * @param width
 * @param canvasWidth
 * @param canvasHeight
 * @param tagsNumber - the number of the tags in the cloud
 */
function drawCloudIcon(value, context, img, width, canvasWidth, canvasHeight, tagsNumber) {
    let id         = 0;
    let realHeight = (width * canvasHeight) / canvasWidth;
    let virtualTag = scaleIconSize(value.x_pos, value.y_pos, width, realHeight, canvasWidth, canvasHeight);

    context.beginPath();
    context.fillStyle = 'red';
    (tagsNumber < 10) ? id = '0' + tagsNumber : id = tagsNumber;
    context.fillText(id, virtualTag.width + 9, virtualTag.height - 3);

    context.drawImage(img, virtualTag.width, virtualTag.height);
    context.strokeStyle = '#ff000015';
    context.stroke();
    context.closePath();
}

/**
 * Function that scales the size of the real map in the size of the image map
 * @param width - real map width
 * @param canvasWidth
 * @returns {number}
 */
function scaleSize(width, canvasWidth) {
    return (100 / width) * (canvasWidth / 100);
}

/**
 * Function that scales the size of the position of an icon respect to the measure in the real map
 * @param width
 * @param height
 * @param realWidth
 * @param realHeight
 * @param canvasWidth
 * @param canvasHeight
 * @returns {{width: number, height: number}}
 */
function scaleIconSize(width, height, realWidth, realHeight, canvasWidth, canvasHeight) {
    let scaledSize = {
        width : 0,
        height: 0
    };

    let ratio = canvasWidth / realWidth;

    scaledSize.width  = ratio * width;
    scaledSize.height = ratio * height;

    return scaledSize;
}

/**
 * Function that shows the element passed as parameter in full screen
 * @param elem
 */
function openFullScreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}

/**
 * Function that converts an image to a base 64 string
 * @param img
 * @returns {Promise<any>}
 */
function convertImageToBase64(img) {
    if (img == null)
        return Promise.resolve(null);

    let image = new Image();

    let canvas  = document.createElement('canvas');
    let context = canvas.getContext('2d');
    let data    = '';

    return new Promise(function (resolve) {

        image.onload = function () {
            canvas.height = this.height;
            canvas.width  = this.width;

            context.drawImage(image, 0, 0);
            data = canvas.toDataURL('image/png');

            resolve(data);
        };

        image.src = URL.createObjectURL(img);
    })
}

/**
 * Function that scales the size from the canvas to the real size
 * @param floorWidth
 * @param canvasWidth
 * @param canvasHeight
 * @param elemWidth
 * @param elemHeight
 * @returns {{x: string, y: string}}
 */
function scaleSizeFromVirtualToReal(floorWidth, canvasWidth, canvasHeight, elemWidth, elemHeight) {
    let ratio = floorWidth / canvasWidth;

    let reversePositionX = ratio * elemWidth;
    let reversePositionY = ratio * elemHeight;

    return {x: reversePositionX.toFixed(2), y: reversePositionY.toFixed(2)};
}



/**
 * Functiont that draws a line on the canvas
 * @param begin
 * @param end
 * @param type
 * @param drawingContext
 * @param showDrawing
 */
function drawLine(begin, end, type, drawingContext, showDrawing) {
    drawingContext.setLineDash([]);
    drawingContext.lineWidth   = 2;
    drawingContext.strokeStyle = 'black';

    if (type === 'vertical') {
        if (showDrawing) {
            drawRect(begin, drawingContext);
            drawRect({x: begin.x, y: end.y}, drawingContext);
        }
        drawingContext.beginPath();
        drawingContext.moveTo(begin.x, begin.y);
        drawingContext.lineTo(begin.x, end.y);
    } else if (type === 'horizontal') {
        if (showDrawing) {
            drawRect(begin, drawingContext);
            drawRect({x: end.x, y: begin.y}, drawingContext);
        }
        drawingContext.beginPath();
        drawingContext.moveTo(begin.x, begin.y);
        drawingContext.lineTo(end.x, begin.y);
    } else if (type === 'inclined') {
        if (showDrawing) {
            drawRect(begin, drawingContext);
            drawRect(end, drawingContext);
        }
        drawingContext.beginPath();
        drawingContext.moveTo(begin.x, begin.y);
        drawingContext.lineTo(end.x, end.y)
    }
    drawingContext.stroke();
    drawingContext.closePath();
}

/**
 * Function that draws a rectangle on the canvas
 * @param begin
 * @param drawingContext
 */
function drawRect(begin, drawingContext) {
    drawingContext.beginPath();
    drawingContext.fillStyle = 'black';
    drawingContext.fillRect(begin.x - 5, begin.y - 5, 10, 10);
    drawingContext.closePath();
}

/**
 * Function that draws a rectangle on the canvas
 * @param begin
 * @param drawingContext
 * @param floorWidth
 * @param canvasWidth
 * @param canvasHeight
 * @param color
 * @param drawingOn
 * @param alpha
 */
// drawIcon(objects[index], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, false);
function drawZoneRect(begin, drawingContext, floorWidth, canvasWidth, canvasHeight, color, drawingOn, alpha) {
    let realHeight = (floorWidth * canvasHeight) / canvasWidth;

    let virtualPositionTop    = scaleIconSize(begin.x, begin.y, floorWidth, realHeight, canvasWidth, canvasHeight);
    let virtualPositionBottom = scaleIconSize(begin.xx, begin.yy, floorWidth, realHeight, canvasWidth, canvasHeight);

    let width  = virtualPositionBottom.width - virtualPositionTop.width;
    let height = virtualPositionBottom.height - virtualPositionTop.height;

    drawingContext.beginPath();
    if (drawingOn) {
        drawingContext.fillStyle = 'black';
        drawingContext.fillRect(virtualPositionTop.width - 5, virtualPositionTop.height - 5, 10, 10);
    }
    drawingContext.globalAlpha = alpha;
    drawingContext.fillStyle   = color;
    drawingContext.fillRect(virtualPositionTop.width | 0, virtualPositionTop.height | 0, width | 0, height | 0);
    drawingContext.globalAlpha = 1.0;
    drawingContext.stroke();
    drawingContext.closePath();

}

/**
 * Function that draws a rectangle on the canvas
 * @param begin
 * @param drawingContext
 * @param floorWidth
 * @param canvasWidth
 * @param canvasHeight
 * @param color
 * @param alpha
 */
// drawIcon(objects[index], bufferContext, image, canvasCtrl.defaultFloor[0].width, bufferCanvas.width, bufferCanvas.height, false);
function drawZoneRectFromDrawing(begin, drawingContext, floorWidth, canvasWidth, canvasHeight, color, alpha) {

    let width  = begin.xx - begin.x;
    let height = begin.yy - begin.y;

    drawingContext.beginPath();
    drawingContext.fillStyle = 'black';
    drawingContext.fillRect(begin.x - 5, begin.y - 5, 10, 10);
    drawingContext.globalAlpha = alpha;
    drawingContext.fillStyle = color;
    drawingContext.fillRect(begin.x, begin.y, width, height);
    drawingContext.globalAlpha = 1.0;
    drawingContext.stroke();
    drawingContext.closePath();
}

function findZone(coords, zones, floor, canvasWidth, canvasHeight) {
    let findedZones = [];
    let realcoords = scaleSizeFromVirtualToReal(floor, canvasWidth, canvasHeight, coords.x, coords.y);
    zones.forEach((z) => {
        if ((realcoords.x > z.x_left && realcoords.x < z.x_right && realcoords.y > z.y_up && realcoords.y < z.y_down)) {
            findedZones.push(z.id);
        }
    });

    return findedZones;
}

function findDrawedZone(coords, zones, floor, canvasWidth, canvasHeight) {
    let findedZones = [];
    zones.forEach((z) => {
        if ((coords.x > z.topLeft.x && coords.x < z.bottomRight.x && coords.y > z.topLeft.y && coords.y < z.bottomRight.y)) {
            findedZones.push(z);
        }
    });

    return findedZones;
}

/**
 * Function that encode the string with the cezar code by the amount passed as parameter
 * @param str
 * @param amount
 * @returns {string}
 */
function cesarShift(str, amount) {

    // Wrap the amount
    if (amount < 0)
        return cesarShift(str, amount + 26);

    // Make an output variable
    let output = '';

    if (str !== undefined) {
        // Go through each character
        for (var i = 0; i < str.length; i++) {

            // Get the character we'll be appending
            let c = str[i];

            // If it's a letter...
            if (c.match(/[a-z]/i)) {

                // Get its code
                var code = str.charCodeAt(i);

                // Uppercase letters
                if ((code >= 65) && (code <= 90))
                    c = String.fromCharCode(((code - 65 + amount) % 26) + 65);

                // Lowercase letters
                else if ((code >= 97) && (code <= 122))
                    c = String.fromCharCode(((code - 97 + amount) % 26) + 97);

            }

            // Append
            output += c;

        }
    }

    // All done!
    return output;
}

let log = (text) => {
    if (DEBUG) {
        let area = document.getElementById("log-area");
        area.value += '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n';
        area.value += text + '\n';
        area.value += '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n';
    }
};

let logarr       = (array) => {
    if (DEBUG && array.result instanceof Array) {
        let area = document.getElementById("log-area");
        area.value += "-------------------------------------------------------------------------------------------\n";
        area.value += "action: " + array.action + "\n";
        area.value += "-------------------------------------------------------------------------------------------\n";
        area.value += "message: \n";
        array.result.forEach(e => {
            let pretty = JSON.stringify(e, undefined, 4);
            area.value += "" + pretty + '\n'
        })
    }
};
/**
 * @return {string}
 */
let lightenColor = function (color, percent) {
    let num = parseInt(color.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R   = (num >> 16) + amt,
        B   = (num >> 8 & 0x00FF) + amt,
        G   = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
};

let listState = [];

// showing and hiding the content of the lists
let displayListCluster = (tag, index) => {
    if (document.getElementById(tag + '_id').style.display === 'none') {
        document.getElementById(tag + '_id').style.display = 'block';
    } else {
        document.getElementById(tag + '_id').style.display = 'none';
    }
};

// version number
const UPDATE_VERSION = "3.31.1";