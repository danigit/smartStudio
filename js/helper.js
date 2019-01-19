/**
 * Function that draw the border of the canvas
 * @param canvas - the canvas on which to draw
 * @param context - the context of the canvas
 * @param space
 */
function drawCanvasBorder(canvas, context, space) {
    context.setLineDash([0, 0]);
    context.strokeStyle = 'black';
    context.fillStyle   = 'black';
    context.lineWidth   = 1;
    context.beginPath();
    context.moveTo(space, space);
    context.lineTo(space, canvas.height - space);
    context.lineTo(canvas.width - space, canvas.height - space);
    context.lineTo(canvas.width - space, space);
    context.lineTo(space, space);
    context.stroke();
}

function encodeRequest(action, data) {
    return JSON.stringify({action: action, data: data});
}

function drawDashedLine(canvas, length, pattern, spacing, width, direction) {
    let context = canvas.getContext('2d');
    let virtualWidth = ((spacing*100)/width) * (canvas.width/100);
    context.strokeStyle = 'lightgray';

    if (direction === 'horizontal') {
        for (let i = 25; i < canvas.height - 25; i += virtualWidth){
            context.beginPath();
            context.setLineDash(pattern);
            console.log('drawing: ');
            context.moveTo(25, i);
            context.lineTo(length - 25, i);
            context.stroke();
        }

    }else if (direction === 'vertical'){
        console.log('drawing vertical');
        for (let i = 25; i < canvas.width - 25; i += virtualWidth){
            context.beginPath();
            context.setLineDash(pattern);
            context.moveTo(i, 25);
            context.lineTo(i, length - 25);
            context.stroke();
        }

    }
}

function updateCanvas(canvas, context, image) {
    if (image !== undefined)
        context.drawImage(image, 0, 0);
    drawCanvasBorder(canvas, context, 25);
}