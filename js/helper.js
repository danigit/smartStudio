/**
 * Function that draw the border of the canvas
 * @param canvas - the canvas on which to draw
 * @param context - the context of the canvas
 */
function drawCanvasBorder(canvas, context) {
    context.setLineDash([0, 0]);
    context.strokeStyle = 'black';
    context.fillStyle   = 'black';
    context.lineWidth   = 1;
    context.beginPath();
    context.moveTo(15, 15);
    context.lineTo(15, canvas.height - 15);
    context.lineTo(canvas.width - 15, canvas.height - 15);
    context.lineTo(canvas.width - 15, 15);
    context.lineTo(15, 15);
    context.stroke();
}