"use strict";

const ALIGN_SPACES = 15;
const MAIN_TITLE = "IoT per la safety dei lavoratori nell'Industria 4.0";
const FOOTER_TEXT ='<span style="font-size:26px;font-weight:bold">SMART TRACK S.R.L.</span><br/>Web site: <a href="http:\\www.smarttrack.io" target="_blank">www.smarttrack.io</a><br/>';


function InitGUI()
{
   var Testo = '';
   for(var i = 0; i < ALIGN_SPACES; i++)
      Testo += '&nbsp';
   document.getElementById('MainHTMLTitle').innerHTML = Testo + MAIN_TITLE;
   document.getElementById('MainHTMLFooter').innerHTML = FOOTER_TEXT;
}