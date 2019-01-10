/*
 ***********************************************************
 ** ZStringFunct - Gestione delle stringhe
 ** Versione 1.0  18 Agosto 2017
 **               - Prima versione
 ***********************************************************/
 
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};