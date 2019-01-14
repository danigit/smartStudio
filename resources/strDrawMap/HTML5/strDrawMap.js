"use strict";

Array.prototype.count = function () {
    var counter = 0; // Initializing main counter
    var i       = 0;
    for (i in this) // Looping through elements
        if (typeof this[i] != "undefined") // If empty it's undefined
            counter++; // Counting not empty elements
    return counter - 1; // Excepting own function
}

var GlobalGoogleMap;

function TDrawPianta(NomeCanvas, WebSocketCoordinates) {
    const STATO_ERRORE          = 0;
    const STATO_LOGIN           = 1;
    const STATO_VISUALIZZAZIONE = 2;
    const STATO_EDITING         = 3;
    const STATO_CAMBIO_PASSWORD = 4;
    const STATO_MODIFICA_ANCORE = 5;
    const STATO_CAMBIO_DIM      = 6;
    const STATO_SELEZIONA_PIANO = 7;
    const STATO_TROVA_BEACON    = 8;
    const STATO_MODIFICA_ZONE   = 9;
    const STATO_MODIFICA_TAG    = 10;
    const STATO_STORICO         = 11;
    const STATO_SHOW_MESSAGE    = 12;

    const ALARM_TAG_EVACUAZIONE  = 'FF';
    const ALARM_TAG_CALL_ME      = 'FE';
    const ALARM_TAG_STOP_EVAC    = 'FB';
    const ALARM_TAG_RESET_CALLME = 'FH';
    const ALARM_TAG_STOP_BLINK   = 'EF';

    const ID_TAG_BROADCAST = 'FFFFFFFFFFFF';

    const BORDER_CANVAS       = 30;
    const BORDER_COLOR        = "black";
    const TACCA_COLOR         = "#808080";
    const SEMI_WIDTH_POINT    = 4;
    const TRK_LINE_HORIZONTAL = 0;
    const TRK_LINE_VERTICAL   = 1;
    const TRK_LINE_NORMAL     = 2;
    const TRK_ERASE_POINT     = 3;
    const ADDZOOM             = 4;
    const SUBZOOM             = 5;
    const ADDANCORA           = 6;
    const NR_RIGHE_ANCORE     = 10;
    const NR_RIGHE_ZONE       = 5;
    const FONT_CARATTERI      = "10px Arial";

    const WIDTH_TAG = 15;

    const COLOR_ALLARME      = "#ff0000";
    const COLOR_FUORI_CAMPO  = "#6f6f6f";
    const COLOR_NO_PROBLEM   = "#008400";
    const COLOR_BORDER_ICONE = "#6e0000";
    const COLOR_SEGNALAZIONE = "#0000ff";

    //*********************************************
    // VARIABILI PRIVATE
    //*********************************************

    var FSomeAllarmeAttivo   = false;
    var FStato;
    var FPreviousStato;
    var FLarghezza;
    var FTacca;
    //variabile del socket che invia informazioni al server
    var FConnessione;
    var FCanvas              = document.getElementById(NomeCanvas);
    var FContext             = FCanvas.getContext("2d");
    var FStartPoint          = null;
    var FEndPoint            = null;
    var FLsSegmenti          = [];
    var FLsHistory           = [];
    var FColorLine           = 'black';
    var FColorEvidence       = 'yellow';
    var FColorErasing        = 'red';
    var FModalita            = TRK_LINE_HORIZONTAL;
    var FLsAncore            = [];
    var FLsVideocamere       = [];
    var FLsZone              = [];
    var FCopiaAncore         = [];
    var FPaginaAncore        = 0;
    var FCopiaZone           = [];
    var FPaginaZone          = 0;
    var FLsFari              = [];
    var FLsCumulativi        = [];
    var FTimer               = null;
    var FPianoAttuale        = null;
    var FNomePiano;
    var FImgMappa;
    var FPosAncora           = null;
    var NrAncore             = 0;
    var FIdTag;
    var FNomeTag;
    var FIdAncora;
    var FSuperUser           = false;
    var FAncoreDaRegistrare  = [];
    var FGraficoAncore       = new TZPieGraph('grpGraficoAncore');
    var FGraficoTag          = new TZPieGraph('grpGraficoTag');
    var FGraficoEmergency    = new TZPieGraph('grpGraficoEmergency');
    var FGoogleMapMode       = false;
    var FGoogleMarkers       = [];
    var FGoogleClusterMarker = null;

    var mouse =
            {
                x            : 0,
                y            : 0,
                w            : 0,
                alt          : false,
                shift        : false,
                ctrl         : false,
                buttonLastRaw: 0, // user modified value
                buttonRaw    : 0,
                over         : false,
                buttons      : [1, 2, 4, 6, 5, 3], // masks for setting and clearing button raw bits;
            };


    var FImageAncora         = null;
    var FImageVideocamera    = null;
    var FImageAncoraSbiadita = null;


//*********************************************
// METODI PRIVATI
//*********************************************
    function FGetAltezza() {
        return ((FLarghezza / (FCanvas.width - 2 * BORDER_CANVAS) * (FCanvas.height - 2 * BORDER_CANVAS)));
    }


    function FEnableButton(NomeBottone, Abilita) {
        var Bottone       = document.getElementById(NomeBottone);
        Bottone.disabled  = !Abilita;
        Bottone.className = Abilita ? (NomeBottone == "BtnAllarmiAttivi" ? "buttonAlarm" : "") : "buttonDisabled";
    }


    function FAssignStyleImages() {
        document.getElementById('CkOrizzontale').src  = FModalita != TRK_LINE_HORIZONTAL ? 'OrizzontaleDisabled.png' : 'OrizzontaleEnabled.png';
        document.getElementById('CkVerticale').src    = FModalita != TRK_LINE_VERTICAL ? 'VerticaleDisabled.png' : 'VerticaleEnabled.png';
        document.getElementById('CkNormale').src      = FModalita != TRK_LINE_NORMAL ? 'NormaleDisabled.png' : 'NormaleEnabled.png';
        document.getElementById('CkErasePoint').src   = FModalita != TRK_ERASE_POINT ? 'ErasePointDisabled.png' : 'ErasePointEnabled.png';
        document.getElementById('AggiungiAncora').src = FModalita != ADDANCORA ? 'LogoAncoraSbiadita.png' : 'LogoAncora.png';
    }

    function FOnClickStyleDrawing(e) {
        var event = window.event || e;
        switch (event.currentTarget.id) {
            case 'CkOrizzontale'  :
                FModalita = TRK_LINE_HORIZONTAL;
                break;
            case 'CkVerticale'    :
                FModalita = TRK_LINE_VERTICAL;
                break;
            case 'CkNormale'      :
                FModalita = TRK_LINE_NORMAL;
                break;
            case 'AggiungiAncora' :
                FModalita = ADDANCORA;
                break;
            case 'CkErasePoint'   :
                FModalita   = TRK_ERASE_POINT;
                FStartPoint = null;
                FEndPoint   = null;
                FPaintCanvas();
                break;
            default               :
                FModalita = TRK_LINE_HORIZONTAL;
                break;
        }
        if (FModalita == ADDANCORA) {
            document.getElementById("DescrizioneIdAncora").style.display = "inline-block";
            document.getElementById("NomeAncora").style.display          = "inline-block";
        } else {
            document.getElementById("DescrizioneIdAncora").style.display = "none";
            document.getElementById("NomeAncora").style.display          = "none";
        }
        FAssignStyleImages();
    }

    function FEnableConfermaCambiaPassword() {
        FEnableButton('BtnConfermaPassword',
            (document.getElementById('pwdNuovaPassword').value.trim() == document.getElementById('pwdCheckPassword').value.trim()));
    }

    function CanDrawFaroOnCanvas(Faro) {
        return ((Faro.Longitudine == 0) &&
            (Faro.Latitudine == 0) &&
            (!Faro.RadioSwitchedOff));
    }

    function FEnableConfermaDimensioni() {
        FEnableButton('BtnConfermaDimMappa',
            (document.getElementById('dimLarghezza').value >= 1000) &&
            (document.getElementById('NamePiani').value != undefined) &&
            (document.getElementById('NamePiani').value != null) &&
            (document.getElementById('NamePiani').value != "") &&
            (document.getElementById('dimTacca').value >= 50));
    }

    function FEnableConfermaNomeTag() {
        FEnableButton('BtnConfermaAnagraficaTag',
            (document.getElementById('nomeTag').value != undefined) &&
            (document.getElementById('nomeTag').value != "") &&
            (document.getElementById('nomeTag').value != null));
    }

    function FOnChangeLogin() {
        FEnableButton('BtnLogin', document.getElementById("logUserName").value.trim() != '');
    }

    function ShowMessage(GetContent, AfterShow) {
        document.getElementById('ShowMessageContent').innerHTML = GetContent();
        FChangeStato(STATO_SHOW_MESSAGE);
        if (AfterShow != undefined) AfterShow();
    }

    function FEnableAllButtons() {
        var Abilita = (FStato == STATO_VISUALIZZAZIONE) && (FPianoAttuale != null);
        FEnableButton('BtnEnableEditing', Abilita);
        //FEnableButton('BtnPosizioneZone',Abilita);
        FEnableButton('BtnCambiaPassword', Abilita);
        FEnableButton('BtnDimensioniMappa', Abilita);
        FEnableButton('BtnPosizioneAncore', Abilita);
        FEnableButton('BtnSelezionaPiano', Abilita);
        FEnableButton('BtnAnagraficaTag', Abilita);
        FEnableButton('BtnDoveSiTrova', Abilita);
        FEnableButton('BtnLogout', Abilita);
        FEnableButton('BtnAllarmiAttivi', Abilita && FSomeAllarmeAttivo);
        FEnableButton('BtnStorico', Abilita);
    }

    function ShowAllButtons() {
        document.getElementById('BtnEnableEditing').style.display   = FSuperUser ? "inline-block" : "none";
        //document.getElementById('BtnPosizioneZone').style.display  = FSuperUser ? "inline-block" : "none";
        document.getElementById('BtnDimensioniMappa').style.display = FSuperUser ? "inline-block" : "none";
        document.getElementById('BtnPosizioneAncore').style.display = FSuperUser ? "inline-block" : "none";
        document.getElementById('BtnAnagraficaTag').style.display   = FSuperUser ? "inline-block" : "none";
    }

    function FSetAncore() {
        FSalvaCopiaPaginaAncore();
        var Ancore   = '';
        var NrAncore = document.getElementById('NumeroAncore').value;
        for (var i = 0; i < NrAncore; i++) {
            if (FCopiaAncore[i] != undefined)
                Ancore += i + ',' + FCopiaAncore[i].xPos + ',' + FCopiaAncore[i].yPos + ',' +
                    FCopiaAncore[i].zPos + ',' + FCopiaAncore[i].Piano + ',' + FCopiaAncore[i].Raggio + ',' +
                    FCopiaAncore[i].Zone + ',' + FCopiaAncore[i].Nome + ',' + FCopiaAncore[i].Ip + ',' +
                    FCopiaAncore[i].Rssi + ',' + (FCopiaAncore[i].Proximity ? '1' : '0');
            else Ancore += i + ',0,0,0,1,0,0,,,0,1';
            if (i < NrAncore - 1) Ancore += '^';
        }
        FConnessione.send('SETANCHORS~' + Ancore);
    }

    function FSetZone() {
        FSalvaCopiaPaginaZone();
        var Zone   = '';
        var NrZone = document.getElementById('NumeroZone').value;
        for (var i = 1; i <= NrZone; i++) {
            if (FCopiaZone[i] != undefined)
                Zone += i + ',' + FCopiaZone[i].xLeft + ',' + FCopiaZone[i].xRight + ',' +
                    FCopiaZone[i].yUp + ',' + FCopiaZone[i].yDown;
            else Zone += i + ',0,0,0,0';

            if (i < NrZone) Zone = Zone + '^';
        }
        FConnessione.send('SETZONES~' + Zone);
    }

    function FSetNomeTag() {
        FConnessione.send('SETBEACONS~' + FNomeTag + '~' + FIdTag);
    }

    function FChangePiano() {
        ChangeModeView(false);
        document.getElementById('mapPiano').innerHTML = FPianoAttuale;
        FConnessione.send('GETPOINTS~' + FPianoAttuale);
    }

    function FLoadFloors(AnswerFloors) {
        var cbListPiani = document.getElementById('PianoSelezionato');
        while (cbListPiani.length > 0)
            cbListPiani.remove(0);
        var option;
        var SingoloPiano;

        var LsPiani = AnswerFloors.split('^');
        if (FPianoAttuale == null) {
            if ((LsPiani.length == 0) || (LsPiani[0] == ""))
                LsPiani[0] = '1,';

            SingoloPiano  = LsPiani[0].split(',');
            FPianoAttuale = SingoloPiano[0];
            FChangePiano();
            FEnableAllButtons();

            var TmpPiano;
            for (TmpPiano of LsPiani)
                if (TmpPiano != "") {
                    SingoloPiano = TmpPiano.split(',');
                    option       = document.createElement('option');
                    if ((SingoloPiano[1] != undefined) && (SingoloPiano[1].trim() != ""))
                        option.text = SingoloPiano[1];
                    else option.text = SingoloPiano[0];
                    option.value = SingoloPiano[0];
                    cbListPiani.add(option);
                }
        }

        document.getElementById("BtnSelezionaPiano").style.display = 'inline';
        document.getElementById("BtnDoveSiTrova").style.display    = 'inline';
    }

    function FLoadEventList(AnswerEventList) {
        var CbDescrEvento = document.getElementById('StoricoDescrEvento');
        while (CbDescrEvento.length > 0)
            CbDescrEvento.remove(0);
        var Option   = document.createElement('option');
        Option.text  = "Qualsiasi evento";
        Option.value = "";
        CbDescrEvento.add(Option);

        var ArrayEvents;
        var SingleEvent;
        var TmpEvent;
        if (AnswerEventList != undefined) {
            ArrayEvents = AnswerEventList.split('^');

            for (TmpEvent of ArrayEvents) {
                SingleEvent = TmpEvent.split(',');
                if ((SingleEvent[0] >= 0) && (SingleEvent[1] != undefined)) {
                    Option       = document.createElement('option');
                    Option.text  = SingleEvent[1];
                    Option.value = SingleEvent[0];
                    CbDescrEvento.add(Option);
                }
                SingleEvent = null;
            }
            ArrayEvents = null;
        }
    }

    function FLoadZones(AnswerZone) {
        if (AnswerZone == 'NOZONES')
            FLsZone = null;
        else {
            FLsZone = [];
            var ArrayZone;
            var SingolaZona;
            var TmpZona;
            if (AnswerZone != undefined) {
                ArrayZone = AnswerZone.split('^');

                for (TmpZona of ArrayZone) {
                    SingolaZona = TmpZona.split(',');
                    if (SingolaZona[0] >= 1)
                        FLsZone[SingolaZona[0]] = {
                            xLeft : SingolaZona[1],
                            xRight: SingolaZona[2],
                            yUp   : SingolaZona[3],
                            yDown : SingolaZona[4]
                        };
                    SingolaZona = null;
                }
                ArrayZone = null;
            }
            //document.getElementById('BtnPosizioneZone').style.display = 'inline';
        }
    }

    function FLoadHistory(AnswerHistory, DataNow, DataSelected, SelectId, SelectEvent) {

        var ArrayHistory;
        var SingolaHistory;
        var TmpHistory;
        FLsHistory = [];
        if (AnswerHistory != undefined) {
            ArrayHistory = AnswerHistory.split('^').slice(0, -1);

            for (TmpHistory of ArrayHistory) {
                SingolaHistory = TmpHistory.split(',');
                FLsHistory.push({
                    IconaEvento: SingolaHistory[0],
                    Tag        : SingolaHistory[1],
                    Ancora     : SingolaHistory[2],
                    TimeStamp  : SingolaHistory[3],
                    xPos       : SingolaHistory[4],
                    yPos       : SingolaHistory[5],
                    DescEvt    : SingolaHistory[6]
                });
                SingolaHistory = null;

            }
            ArrayHistory = null;
        }
        RefreshDivStorico();
    }


    function FLoadAncore(AnswerAncore) {
        var ArrayAncore;
        var SingolaAncora;
        var TmpAncora;
        var Contatore         = 0;
        var ContatoreSbiadite = 0;

        FLsAncore = [];

        if (AnswerAncore != undefined) {
            ArrayAncore = AnswerAncore.split('^');
            for (TmpAncora of ArrayAncore) {
                SingolaAncora = TmpAncora.split(',');
                if ((SingolaAncora[0] >= 0) && (SingolaAncora[0] != "")) {
                    FLsAncore[SingolaAncora[0]] = {
                        xPos     : SingolaAncora[1],
                        yPos     : SingolaAncora[2],
                        zPos     : SingolaAncora[3],
                        Piano    : SingolaAncora[4],
                        Raggio   : SingolaAncora[5],
                        Sbiadita : SingolaAncora[6] != 0,
                        Nome     : SingolaAncora[7],
                        Mac      : SingolaAncora[8],
                        Building : SingolaAncora[9],
                        Proximity: SingolaAncora[10] != 0,
                        Rssi     : SingolaAncora[11],
                        Ip       : SingolaAncora[12],
                        Zone     : SingolaAncora[13]
                    };
                    Contatore++;
                    if (FLsAncore[SingolaAncora[0]].Sbiadita) ContatoreSbiadite++;
                }
                SingolaAncora = null;
            }
            ArrayAncore = null;
            FGraficoAncore.ClearPercent();
            FGraficoAncore.AddPercent({
                Name       : 'Offline',
                Description: 'Offline',
                Value      : ContatoreSbiadite,
                Color      : '#8bc1b3',
                Total      : Contatore
            });
            FGraficoAncore.AddPercent({
                Name       : 'Online',
                Description: 'Online',
                Value      : Contatore - ContatoreSbiadite,
                Color      : '#2d9981',
                Total      : Contatore
            });
            FGraficoAncore.Refresh();
        }
        if (FLsAncore.count() <= NR_RIGHE_ANCORE) document.getElementById('HeaderAncore').style.display = 'none'; // Nascone la barra perchè le ancore non possono essere aggiunte
    }

    function FLoadVideocamere(AnswerVideocamere) {
        var ArrayVideocamere;
        var SingolaVideocamera;
        var TmpVideocamera;

        FLsVideocamere = [];

        if (AnswerVideocamere != undefined) {
            ArrayVideocamere = AnswerVideocamere.split('^');
            for (TmpVideocamera of ArrayVideocamere) {
                SingolaVideocamera                    = TmpVideocamera.split(',');
                FLsVideocamere[SingolaVideocamera[0]] = {
                    xPos     : SingolaVideocamera[1],
                    yPos     : SingolaVideocamera[2],
                    Piano    : SingolaVideocamera[3],
                    IpAddress: SingolaVideocamera[4],
                    NVR      : SingolaVideocamera[5],
                    Camera   : SingolaVideocamera[6],
                    User     : SingolaVideocamera[7],
                    Pwd      : SingolaVideocamera[8],
                    Radius   : SingolaVideocamera[9]
                };
                SingolaVideocamera                    = null;
            }
            ArrayVideocamere = null;
        }
    }

    function FLoadFari(AlarmEngineOff, AnswerBeacons) {
        var ArrayFari;
        var SingoloFaro;
        var TmpFaro;
        var AlarmBattery           = false;
        var AlarmManDown           = false;
        var FPrecLsFari            = FLsFari;
        var Contatore              = 0;
        var ContatoreFuoriCampo    = 0;
        var ContatoreSpenti        = 0;
        var ContatoreEmergencyZone = 0;
        var VideoDaAprire          = undefined;
        FLsFari                    = [];

        AlarmEngineOff                                          = AlarmEngineOff != '0';
        document.getElementById('AlarmEngineOff').style.display = AlarmEngineOff ? "block" : "none";
        if (AnswerBeacons != undefined) {
            ArrayFari          = AnswerBeacons.split('^');
            FSomeAllarmeAttivo = false;
            for (TmpFaro of ArrayFari) {
                SingoloFaro = TmpFaro.split(',');
                if (SingoloFaro[0] >= 1) {
                    var PrecBatteryAlarm = (FPrecLsFari[SingoloFaro[0]] != undefined) && (FPrecLsFari[SingoloFaro[0]].Batteria != '0');
                    var PrecManDownAlarm = (FPrecLsFari[SingoloFaro[0]] != undefined) && (FPrecLsFari[SingoloFaro[0]].UomoATerra != '0');

                    var SuonaMp3 = function (FileMP3) {
                        var Suono = document.createElement('audio');
                        Suono.src = FileMP3;
                        Suono.play();
                        Suono = undefined;
                    };

                    FLsFari[SingoloFaro[0]] = {
                        xPos               : SingoloFaro[1],
                        yPos               : SingoloFaro[2],
                        Piano              : SingoloFaro[3],
                        FuoriCampo         : (SingoloFaro[4] == 1) || AlarmEngineOff,
                        UomoATerra         : (SingoloFaro[5] == undefined ? '0' : SingoloFaro[5]),
                        Nome               : SingoloFaro[6],
                        Elmetto            : SingoloFaro[7],
                        Cintura            : SingoloFaro[8],
                        Guanti             : SingoloFaro[9],
                        Scarpe             : SingoloFaro[10],
                        Fune               : SingoloFaro[11],
                        MandownTacitato    : SingoloFaro[12],
                        MandownDisabilitato: SingoloFaro[13],
                        Batteria           : SingoloFaro[14],
                        Mac                : SingoloFaro[15],
                        AncoraRif          : SingoloFaro[16],
                        RadioSwitchedOff   : (SingoloFaro[17] == 1),
                        EmergencyZone      : SingoloFaro[18],
                        CallMeAlarm        : SingoloFaro[19],
                        EvacuationAlarm    : SingoloFaro[20],
                        Latitudine         : parseFloat(SingoloFaro[21]),
                        Longitudine        : parseFloat(SingoloFaro[22])
                    };

                    if ((FLsFari[SingoloFaro[0]].UomoATerra == "1") && (!PrecManDownAlarm) &&
                        (FLsFari[SingoloFaro[0]].Latitudine == 0) && (FLsFari[SingoloFaro[0]].Longitudine == 0))
                        if (VideoDaAprire == undefined)
                            for (var i = 0; i < FLsVideocamere.length; i++)
                                if (FLsVideocamere[i] != undefined) {
                                    var Distance = Math.sqrt(Math.pow(FLsVideocamere[i].xPos - FLsFari[SingoloFaro[0]].xPos, 2) +
                                        Math.pow(FLsVideocamere[i].yPos - FLsFari[SingoloFaro[0]].yPos, 2));
                                    if (Distance <= FLsVideocamere[i].Radius) {
                                        VideoDaAprire = i;
                                        break;
                                    }
                                }

                    Contatore++;
                    if (FLsFari[SingoloFaro[0]].RadioSwitchedOff)
                        ContatoreSpenti++;
                    else {
                        if (FLsFari[SingoloFaro[0]].FuoriCampo)
                            ContatoreFuoriCampo++;
                        else {
                            if (FLsFari[SingoloFaro[0]].EmergencyZone != '0')
                                ContatoreEmergencyZone++;
                        }
                    }


                    FSomeAllarmeAttivo |= ((FLsFari[SingoloFaro[0]].UomoATerra == "1") ||
                        (FLsFari[SingoloFaro[0]].Elmetto == "1") ||
                        (FLsFari[SingoloFaro[0]].Cintura == "1") ||
                        (FLsFari[SingoloFaro[0]].Guanti == "1") ||
                        (FLsFari[SingoloFaro[0]].Scarpe == "1") ||
                        (FLsFari[SingoloFaro[0]].Batteria == "1") ||
                        (FLsFari[SingoloFaro[0]].FuoriCampo) ||
                        (FLsFari[SingoloFaro[0]].Fune == "1")) && (!FLsFari[SingoloFaro[0]].RadioSwitchedOff);

                    AlarmBattery |= (!PrecBatteryAlarm && (FLsFari[SingoloFaro[0]].Batteria != '0')) &&
                        (!FLsFari[SingoloFaro[0]].RadioSwitchedOff) &&
                        (!FLsFari[SingoloFaro[0]].FuoriCampo);
                    AlarmManDown |= (!PrecManDownAlarm && (FLsFari[SingoloFaro[0]].UomoATerra != '0')) &&
                        (!FLsFari[SingoloFaro[0]].RadioSwitchedOff) &&
                        (!FLsFari[SingoloFaro[0]].FuoriCampo);
                }
                SingoloFaro = null;
            }
            ArrayFari = null;

            FGraficoEmergency.ClearPercent();
            FGraficoEmergency.AddPercent({
                Name       : 'AlSicuro',
                Description: 'Presenti',
                Value      : ContatoreEmergencyZone,
                Color      : '#ffc000',
                Total      : Contatore
            });
            FGraficoEmergency.AddPercent({
                Name       : 'FuoriZona',
                Description: 'Dispersi',
                Value      : Contatore - ContatoreEmergencyZone,
                Color      : '#ff0000',
                Total      : Contatore
            });
            FGraficoEmergency.Refresh();

            FGraficoTag.ClearPercent();
            FGraficoTag.AddPercent({
                Name       : 'Offline',
                Description: 'Offline',
                Value      : ContatoreSpenti,
                Color      : '#a8b7ce',
                Total      : Contatore
            });
            FGraficoTag.AddPercent({
                Name       : 'FuoriCampo',
                Description: 'Out',
                Value      : ContatoreFuoriCampo,
                Color      : '#2c95fd',
                Total      : Contatore
            });
            FGraficoTag.AddPercent({
                Name       : 'InCampo',
                Description: 'Online',
                Value      : Contatore - ContatoreFuoriCampo - ContatoreSpenti,
                Color      : '#37699a',
                Total      : Contatore
            });
            FGraficoTag.Refresh();

            if (AlarmBattery) {
                if (AlarmManDown) SuonaMp3('MP3/sndMultipleAlarm.mp3');
                else SuonaMp3('MP3/sndBatteryAlarm.mp3');
            } else {
                if (AlarmManDown) SuonaMp3('MP3/sndManDownAlarm.mp3');
            }

            if (VideoDaAprire != undefined)
                OpenVideoCamera(FLsVideocamere[VideoDaAprire]);

            FEnableAllButtons();
        }
    }

    function LogOut() {
        if (FTimer != null) {
            clearInterval(FTimer);
            FTimer = null;
        }
        FConnessione.send('LOGOUT');
    }

    function FSalvaCopiaPaginaAncore() {
        var PrimaRiga    = FPaginaAncore * NR_RIGHE_ANCORE;
        var NumeroAncore = document.getElementById('NumeroAncore').value;
        for (var i = 1; i <= NR_RIGHE_ANCORE; i++) {
            if (i + PrimaRiga - 1 > NumeroAncore) break;
            FCopiaAncore[i + PrimaRiga - 1] = {
                xPos     : document.getElementById('ancXPos' + i).value,
                yPos     : document.getElementById('ancYPos' + i).value,
                zPos     : document.getElementById('ancZPos' + i).value,
                Piano    : document.getElementById('ancPiano' + i).value,
                Zone     : document.getElementById('ancZona' + i).value,
                Raggio   : document.getElementById('ancRaggio' + i).value,
                Nome     : document.getElementById('ancNome' + i).value,
                Ip       : document.getElementById('ancIP' + i).value,
                Rssi     : document.getElementById('ancRSSI' + i).value,
                Proximity: document.getElementById('ancProximity' + i).value != 0
            };
        }
    }

    function FSalvaCopiaPaginaZone() {
        var PrimaRiga  = FPaginaZone * NR_RIGHE_ZONE + 1;
        var NumeroZone = document.getElementById('NumeroZone').value;
        for (var i = 1; i <= NR_RIGHE_ZONE; i++) {
            if (i + PrimaRiga - 1 > NumeroZone) break;
            FCopiaZone[i + PrimaRiga - 1] = {
                xLeft : document.getElementById('zonXLeft' + i).value,
                xRight: document.getElementById('zonXRight' + i).value,
                yUp   : document.getElementById('zonYUp' + i).value,
                yDown : document.getElementById('zonYDown' + i).value
            };
        }
    }

    function FDisponiPaginaAncore() {
        var NrRighe   = 0;
        var NrRighe   = 0;
        var NumAncore = document.getElementById('NumeroAncore').value;

        if ((FPaginaAncore + 1) * NR_RIGHE_ANCORE <= NumAncore) NrRighe = NR_RIGHE_ANCORE;
        else NrRighe = NumAncore % NR_RIGHE_ANCORE;

        for (var i = 1; i <= NR_RIGHE_ANCORE; i++)
            document.getElementById("RigaAncora" + i).style.display = i <= NrRighe ? 'block' : 'none';

        FEnableButton("BtnPagAncoreSuccessive", (FPaginaAncore + 1) * NR_RIGHE_ANCORE < NumAncore);
        FEnableButton("BtnPagAncorePrecedenti", FPaginaAncore != 0);

        var PrimaRiga = FPaginaAncore * NR_RIGHE_ANCORE;
        for (var i = PrimaRiga; i < NR_RIGHE_ANCORE + PrimaRiga; i++) {
            document.getElementById('ancNome' + (i - PrimaRiga + 1)).value      = FCopiaAncore[i] == undefined ? '' : FCopiaAncore[i].Nome;
            document.getElementById('ancXPos' + (i - PrimaRiga + 1)).value      = FCopiaAncore[i] == undefined ? 0 : FCopiaAncore[i].xPos;
            document.getElementById('ancYPos' + (i - PrimaRiga + 1)).value      = FCopiaAncore[i] == undefined ? 0 : FCopiaAncore[i].yPos;
            document.getElementById('ancZPos' + (i - PrimaRiga + 1)).value      = FCopiaAncore[i] == undefined ? 0 : FCopiaAncore[i].zPos;
            document.getElementById('ancRaggio' + (i - PrimaRiga + 1)).value    = FCopiaAncore[i] == undefined ? 0 : FCopiaAncore[i].Raggio;
            document.getElementById('ancPiano' + (i - PrimaRiga + 1)).value     = FCopiaAncore[i] == undefined ? 1 : FCopiaAncore[i].Piano;
            document.getElementById('ancZona' + (i - PrimaRiga + 1)).value      = FCopiaAncore[i] == undefined ? 0 : FCopiaAncore[i].Zone;
            document.getElementById('LbAncora' + (i - PrimaRiga + 1)).innerHTML = 'Ancora nr. ' + i;
            document.getElementById('ancIP' + (i - PrimaRiga + 1)).value        = FCopiaAncore[i] == undefined ? '' : FCopiaAncore[i].Ip;
            document.getElementById('ancRSSI' + (i - PrimaRiga + 1)).value      = FCopiaAncore[i] == undefined ? '' : FCopiaAncore[i].Rssi;
            document.getElementById('ancProximity' + (i - PrimaRiga + 1)).value = FCopiaAncore[i] == undefined ? '' : (FCopiaAncore[i].Proximity ? '1' : '0');
        }

    }

    function FDisponiPaginaZone() {
        var NrRighe = 0;
        var NumZone = document.getElementById('NumeroZone').value;

        if ((FPaginaZone + 1) * NR_RIGHE_ZONE <= NumZone) NrRighe = NR_RIGHE_ZONE;
        else NrRighe = NumZone % NR_RIGHE_ZONE;

        for (var i = 1; i <= NR_RIGHE_ZONE; i++)
            document.getElementById("RigaZona" + i).style.display = i <= NrRighe ? 'block' : 'none';

        FEnableButton("BtnPagZoneSuccessive", (FPaginaZone + 1) * NR_RIGHE_ZONE < NumZone);
        FEnableButton("BtnPagZonePrecedenti", FPaginaZone != 0);

        var PrimaRiga = FPaginaZone * NR_RIGHE_ZONE + 1;
        for (var i = PrimaRiga; i < NR_RIGHE_ZONE + PrimaRiga; i++) {
            document.getElementById('zonXLeft' + (i - PrimaRiga + 1)).value   = FCopiaZone[i] == undefined ? 0 : FCopiaZone[i].xLeft;
            document.getElementById('zonXRight' + (i - PrimaRiga + 1)).value  = FCopiaZone[i] == undefined ? 0 : FCopiaZone[i].xRight;
            document.getElementById('zonYUp' + (i - PrimaRiga + 1)).value     = FCopiaZone[i] == undefined ? 0 : FCopiaZone[i].yUp;
            document.getElementById('zonYDown' + (i - PrimaRiga + 1)).value   = FCopiaZone[i] == undefined ? 0 : FCopiaZone[i].yDown;
            document.getElementById('LbZona' + (i - PrimaRiga + 1)).innerHTML = 'Zona nr. ' + i;
        }
    }

    function RefreshDivStorico() {
        var $HTMLStorico = "<div style=\"clear:both;font-weight:bold;color:white;height:20px;background-color:#ED6C2C;padding-top:2px\">" +
            "<div style=\"width:20%;text-align:left;float:left;padding-left:3px\">Data</div>" +
            "<div style=\"width:10%;text-align:left;float:left;\">Evento</div>" +
            "<div style=\"width:22%;text-align:left;float:left;\">Nome</div>" +
            "<div style=\"width:22%;text-align:left;float:left;\">Ancora</div>" +
            "<div style=\"width:12%;text-align:left;float:left;\">Coord. X</div>" +
            "<div style=\"width:12%;text-align:left;float:left;\">Coord. Y</div>" +
            "</div>";


        for (var i = 0; i < FLsHistory.length; i++) {
            let TempData = FLsHistory[i].TimeStamp.split(' ');
            TempData     = TempData[2] + "/" + TempData[1] + "/" + TempData[0] + " " + TempData[3] + ":" + TempData[4] + ":" + TempData[5];
            $HTMLStorico += "<div style=\"clear:both;font-weight:normal;height:50px;background-color:#" + (i % 2 == 1 ? "CFCFCF" : "BFBFBF") + "\">" +
                "<div style=\"width:20%;text-align:left;float:left;padding-top:10px;padding-left:3px\">" + TempData + "</div>" +
                "<div style=\"width:10%;text-align:left;float:left;padding-top:4px;\">" +
                "<div style=\"height:28px;\"><img src=\"" + FLsHistory[i].IconaEvento + "\" style=\"width:27px;height:27px;\" title=\"" + FLsHistory[i].DescEvt + "\"/></div>" +
                "<div style=\"height:10px;font-size:6px;font-weight:bold;\">" + FLsHistory[i].DescEvt + "</div>" +
                "</div>" +
                "<div style=\"width:22%;text-align:left;float:left;padding-top:10px;\">" + FLsHistory[i].Tag + "</div>" +
                "<div style=\"width:22%;text-align:left;float:left;padding-top:10px;\">" + FLsHistory[i].Ancora + "</div>" +
                "<div style=\"width:12%;text-align:left;float:left;padding-top:10px;\">" + FLsHistory[i].xPos + "</div>" +
                "<div style=\"width:12%;text-align:left;float:left;padding-top:10px;\">" + FLsHistory[i].yPos + "</div>" +
                "</div>";
        }

        document.getElementById("ListaStorico").innerHTML = $HTMLStorico;

    }

    function FCheckDlgStoricoDates() {
        if (document.getElementById('StoricoAlData').value == "") document.getElementById('StoricoAlData').value = ZHTMLInputFromDate(new Date());
        if (document.getElementById('StoricoAlOra').value == "") document.getElementById('StoricoAlOra').value = '23:59';
        if (document.getElementById('StoricoDalOra').value == "") document.getElementById('StoricoDalOra').value = '00:00';
        if ((document.getElementById('StoricoDalData').value == "") ||
            (document.getElementById('StoricoDalData').value + " " + document.getElementById('StoricoDalOra').value >=
                document.getElementById('StoricoAlData').value + " " + document.getElementById('StoricoAlOra').value)) {
            let DataDal                                     = new Date(ZDateFromHTMLInput(document.getElementById('StoricoAlData').value, document.getElementById('StoricoAlOra').value) - (24 * 60 * 60000));
            document.getElementById('StoricoDalData').value = ZHTMLInputFromDate(DataDal);
            document.getElementById('StoricoDalOra').value  = ZHTMLInputFromTime(DataDal);
        }

    }

    function FOnRefreshStorico() {
        var DataDal = document.getElementById('StoricoDalData').value + " " + document.getElementById('StoricoDalOra').value + " 00";
        var DataAl  = document.getElementById('StoricoAlData').value + " " + document.getElementById('StoricoAlOra').value + " 00";
        DataDal     = DataDal.replaceAll('-', ' ').replaceAll(':', ' ');
        DataAl      = DataAl.replaceAll('-', ' ').replaceAll(':', ' ');
        FConnessione.send('GETHISTORY~' + DataAl + '~' + DataDal + '~' +
            document.getElementById('StoricoTag').value + '~' + document.getElementById('StoricoDescrEvento').value);
    }

    function FChangeStato(NewStato) {
        if (FStato == NewStato) return;
        if (FTimer != null) {
            clearInterval(FTimer);
            FTimer = null;
        }

        document.getElementById("DlgLogin").style.visibility          = NewStato == STATO_LOGIN ? 'visible' : 'hidden';
        document.getElementById("DlgLogin").style.left                = ((window.innerWidth - document.getElementById('DlgLogin').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgChangePassword").style.visibility = NewStato == STATO_CAMBIO_PASSWORD ? 'visible' : 'hidden';
        document.getElementById("DlgChangePassword").style.left       = ((window.innerWidth - document.getElementById('DlgChangePassword').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgAncore").style.visibility         = NewStato == STATO_MODIFICA_ANCORE ? 'visible' : 'hidden';
        document.getElementById("DlgAncore").style.left               = ((window.innerWidth - document.getElementById('DlgAncore').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgLockAll").style.left              = ((window.innerWidth - document.getElementById('DlgLockAll').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgDimensioni").style.visibility     = NewStato == STATO_CAMBIO_DIM ? 'visible' : 'hidden';
        document.getElementById("DlgDimensioni").style.left           = ((window.innerWidth - document.getElementById('DlgDimensioni').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgSelectPiano").style.visibility    = NewStato == STATO_SELEZIONA_PIANO ? 'visible' : 'hidden';
        document.getElementById("DlgSelectPiano").style.left          = ((window.innerWidth - document.getElementById('DlgSelectPiano').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgTrovaBeacon").style.visibility    = NewStato == STATO_TROVA_BEACON ? 'visible' : 'hidden';
        document.getElementById("DlgTrovaBeacon").style.left          = ((window.innerWidth - document.getElementById('DlgTrovaBeacon').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgAnagraficaTag").style.visibility  = NewStato == STATO_MODIFICA_TAG ? 'visible' : 'hidden';
        document.getElementById("DlgAnagraficaTag").style.left        = ((window.innerWidth - document.getElementById('DlgAnagraficaTag').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgZone").style.visibility           = NewStato == STATO_MODIFICA_ZONE ? 'visible' : 'hidden';
        document.getElementById("DlgZone").style.left                 = ((window.innerWidth - document.getElementById('DlgZone').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgStorico").style.visibility        = NewStato == STATO_STORICO ? 'visible' : 'hidden';
        document.getElementById("DlgStorico").style.left              = ((window.innerWidth - document.getElementById('DlgStorico').offsetWidth) / 2).toFixed(0) + "px";
        document.getElementById("DlgShowMessage").style.visibility    = NewStato == STATO_SHOW_MESSAGE ? 'visible' : 'hidden';
        document.getElementById("DlgShowMessage").style.left          = ((window.innerWidth - document.getElementById('DlgShowMessage').offsetWidth) / 2).toFixed(0) + "px";

        if (NewStato == STATO_SELEZIONA_PIANO) {
            var SelectPiano = document.getElementById('PianoSelezionato');
            for (var i = 0; i < SelectPiano.length; i++)
                if (SelectPiano.options[i].value == FPianoAttuale) {
                    SelectPiano.selectedIndex = i;
                    break;
                }
        }

        if (NewStato == STATO_STORICO) {
            FCheckDlgStoricoDates();
            FOnRefreshStorico();
        }

        if ((NewStato == STATO_MODIFICA_TAG) || (NewStato == STATO_STORICO)) {
            var SelectFaro = document.getElementById(NewStato == STATO_STORICO ? 'StoricoTag' : 'FaroSelezionato2');
            var Option;
            while (SelectFaro.length > 0)
                SelectFaro.remove(0);
            if (NewStato == STATO_STORICO) {
                Option       = document.createElement('option');
                Option.value = "";
                Option.text  = 'Qualsiasi tag';
                SelectFaro.add(Option);
            }
            for (i in FLsFari)
                if ((FLsFari[i] != undefined) && (!isNaN(i))) {
                    Option      = document.createElement('option');
                    let TmpNome = i;
                    if (NewStato == STATO_STORICO) {
                        if (FLsFari[i].Nome != "") TmpNome = FLsFari[i].Nome;
                        Option.value = i;
                    }
                    Option.text = TmpNome;
                    SelectFaro.add(Option);
                    if (NewStato == STATO_MODIFICA_TAG) {
                        document.getElementById('nomeTag').value = FLsFari[SelectFaro.options[SelectFaro.selectedIndex].value].Nome;
                        document.getElementById('FaroSelezionato2').addEventListener('change', function () {
                            document.getElementById('nomeTag').value = FLsFari[SelectFaro.options[SelectFaro.selectedIndex].value].Nome;
                        });
                    }

                }
        }

        if (NewStato == STATO_TROVA_BEACON) {
            {
                var SelectFaro = document.getElementById('FaroSelezionato');
                while (SelectFaro.length > 0)
                    SelectFaro.remove(0);
                for (i in FLsFari)
                    if ((FLsFari[i] != undefined) && (!isNaN(i))) {
                        var Option = document.createElement('option');
                        if (FLsFari[i].Nome != "")
                            Option.text = FLsFari[i].Nome;
                        else
                            Option.text = i;
                        SelectFaro.add(Option);
                    }
            }
        }

        if (NewStato == STATO_MODIFICA_ANCORE) {
            FCopiaAncore = FLsAncore.slice();

            document.getElementById("NumeroAncore").value = FCopiaAncore.count();
            FPaginaAncore                                 = 0;
            FDisponiPaginaAncore();

        }

        if (NewStato == STATO_MODIFICA_ZONE) {
            FCopiaZone = FLsZone.slice();

            document.getElementById("NumeroZone").value = FCopiaZone.count();
            FPaginaZone                                 = 0;
            FDisponiPaginaZone();

        }

        if (NewStato == STATO_CAMBIO_DIM) {
            document.getElementById('dimLarghezza').value = (FLarghezza * 100).toFixed(0);
            document.getElementById('dimTacca').value     = (FTacca * 100).toFixed(0);
            document.getElementById('NamePiani').value    = FNomePiano;
            //document.getElementById('imm').value          = FImgMappa;
        }

        if (NewStato == STATO_CAMBIO_PASSWORD) {
            document.getElementById("pwdOldPassword").focus();
            document.getElementById("pwdOldPassword").value   = '';
            document.getElementById("pwdNuovaPassword").value = '';
            document.getElementById("pwdCheckPassword").value = '';
            FEnableConfermaCambiaPassword();
        }

        if (NewStato == STATO_LOGIN) {
            FOnChangeLogin();
            document.getElementById("logUserName").focus();
            document.getElementById("logUserName").value         = '';
            document.getElementById("logPassword").value         = '';
            FCanvas.width                                        = document.getElementById('PanelCntMap').offsetWidth;
            FCanvas.height                                       = document.getElementById('PanelCntMap').offsetHeight;
            document.getElementById('divGoogleMap').style.width  = document.getElementById('PanelCntMap').offsetWidth + "px";
            document.getElementById('divGoogleMap').style.height = document.getElementById('PanelCntMap').offsetHeight + "px";
        }

        document.getElementById("DlgLockAll").style.visibility = NewStato == STATO_ERRORE ? 'visible' : 'hidden';
        if (NewStato != STATO_ERRORE)
            document.getElementById('BtnCloseMessage').style.visibility = 'hidden';
        document.getElementById("PanelMap").style.visibility = (NewStato == STATO_EDITING) || (NewStato == STATO_VISUALIZZAZIONE) ? 'visible' : 'hidden';
        document.getElementById("mapPiano").style.visibility = document.getElementById("PanelMap").style.visibility;
        document.getElementById("LbPiano").style.visibility  = document.getElementById("PanelMap").style.visibility;
        document.getElementById("PanelCmd").style.display    = (NewStato == STATO_EDITING) ? 'block' : 'none';
        document.getElementById("PanelDati").style.display   = (NewStato == STATO_VISUALIZZAZIONE) ? 'block' : 'none';
        document.getElementById("PanelEmpty").style.display  = ((NewStato != STATO_VISUALIZZAZIONE) && (NewStato != STATO_EDITING)) ? 'block' : 'none';

        if (NewStato == STATO_EDITING)
            FAssignStyleImages();

        if ((NewStato == STATO_EDITING) || (NewStato == STATO_VISUALIZZAZIONE)) {
            document.getElementById("BtnEnableEditing").innerHTML = (NewStato == STATO_EDITING) ? 'Visualizza' : 'Modifica';
            FPaintCanvas();
        }
        FPreviousStato = FStato;
        FStato         = NewStato;
        FEnableAllButtons();
        if (NewStato == STATO_VISUALIZZAZIONE)
            FTimer = setInterval(function () {
                FConnessione.send('GETBEACONS~' + FPianoAttuale);
                FConnessione.send("GETANCHORS");
            }, 1000);

    }

    function FShowError(Errore, ShowBtnChiudi) {
        document.getElementById("msgErrore").innerHTML              = '<br/>' + Errore + '<br/><br/>';
        document.getElementById('BtnCloseMessage').style.visibility = ShowBtnChiudi ? 'visible' : 'hidden';
        FChangeStato(STATO_ERRORE);
    }

    function FAttendiConnessione() {
        document.getElementById("msgErrore").innerHTML              = '<br/>Connessione in corso ...<br/><br/>';
        document.getElementById('BtnCloseMessage').style.visibility = 'hidden';
        FChangeStato(STATO_ERRORE);
    }

    //*********************************************
    // METODI PER LA GESTIONE DELLA CANVAS
    //*********************************************
    function FDrawPoint(X, Y, ColorLine) {
        if (ColorLine == undefined) ColorLine = FColorLine;
        FContext.fillStyle   = ColorLine;
        FContext.strokeStyle = ColorLine;
        FContext.fillRect(X - SEMI_WIDTH_POINT, Y - SEMI_WIDTH_POINT, SEMI_WIDTH_POINT * 2, SEMI_WIDTH_POINT * 2);
    }

    function FDrawLine(X1, Y1, X2, Y2) {
        FContext.strokeStyle = FColorLine;
        FContext.beginPath();
        FContext.moveTo(X1, Y1);
        FContext.lineTo(X2, Y2)
        FContext.stroke();
    }


    function encodeImageFileAsURL() {
        var filesSelected = document.getElementById("immagine").files;
        if (filesSelected.length > 0) {
            var fileToLoad = filesSelected[0];

            var fileReader = new FileReader();

            fileReader.onload = function (fileLoadedEvent) {
                var srcData = fileLoadedEvent.target.result;

                var newImage = document.createElement('img');
                newImage.src = srcData;
                FImgMappa    = newImage.src;

                //document.getElementById('imm').value = FImgMappa;

            }
            fileReader.readAsDataURL(fileToLoad);
        }
    }

    function FGetRealWidthXFromVirtualX(VirtualX) {
        var Result = -1;

        if (FCanvas.width > 2 * BORDER_CANVAS) {
            var RapX = FLarghezza / (FCanvas.width - 2 * BORDER_CANVAS);
            Result   = VirtualX * RapX;
        }
        return (Result);
    }

    function FGetRealHeightYFromVirtualY(VirtualY) {
        var Result = -1;

        if (FCanvas.width > 2 * BORDER_CANVAS) {
            var RapY = FGetAltezza() / (FCanvas.height - 2 * BORDER_CANVAS);
            Result   = VirtualY * RapY;
        }
        return (Result);
    }

    function FGetRealXFromVirtualX(VirtualX) {

        var Result = -1;

        if (FCanvas.width > 2 * BORDER_CANVAS)
            if ((VirtualX >= BORDER_CANVAS) && (VirtualX <= FCanvas.width - BORDER_CANVAS)) {
                var RapX = FLarghezza / (FCanvas.width - 2 * BORDER_CANVAS);
                Result   = ((VirtualX - BORDER_CANVAS) * RapX);
            }
        return (Result);


    }

    function FGetRealYFromVirtualY(VirtualY) {
        var Result = -1;
        if (FCanvas.height > 2 * BORDER_CANVAS)
            if ((VirtualY >= BORDER_CANVAS) && (VirtualY <= FCanvas.height - BORDER_CANVAS)) {
                var RapY = FGetAltezza() / (FCanvas.height - 2 * BORDER_CANVAS);
                Result   = FGetAltezza() - ((VirtualY - BORDER_CANVAS) * RapY);
            }
        return (Result);
    }

    function FGetVirtualXFromRealX(RealX) {
        var Result = -1;
        if (FCanvas.width > 2 * BORDER_CANVAS) {
            var RapX = (FCanvas.width - 2 * BORDER_CANVAS) / FLarghezza;
            Result   = (RealX * RapX) + BORDER_CANVAS;
        }
        return (Result);
    }

    function FGetVirtualYFromRealY(RealY) {
        var Result = -1;
        if (FCanvas.height > 2 * BORDER_CANVAS) {
            var RapY = (FCanvas.height - 2 * BORDER_CANVAS) / FGetAltezza();
            Result   = (FCanvas.height - 2 * BORDER_CANVAS) - (RealY * RapY) + BORDER_CANVAS;
        }
        return (Result);
    }

    // Ritorna il punto più vicino. Le variabili passate sono in pixel
    function FGetNearestPoint(X, Y) {
        var i;
        for (i in FLsSegmenti) {
            if ((Math.abs(FGetVirtualXFromRealX(FLsSegmenti[i].X1) - X) <= SEMI_WIDTH_POINT) &&
                (Math.abs(FGetVirtualYFromRealY(FLsSegmenti[i].Y1) - Y) <= SEMI_WIDTH_POINT))
                return ({index: i, Punto: 1});
            if ((Math.abs(FGetVirtualXFromRealX(FLsSegmenti[i].X2) - X) <= SEMI_WIDTH_POINT) &&
                (Math.abs(FGetVirtualYFromRealY(FLsSegmenti[i].Y2) - Y) <= SEMI_WIDTH_POINT))
                return ({index: i, Punto: 2});
        }
        return (null);
    }

    function mouseMove(event) {
        mouse.x = event.offsetX;
        mouse.y = event.offsetY;
        if (mouse.x === undefined) {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        }
        mouse.alt   = event.altKey;
        mouse.shift = event.shiftKey;
        mouse.ctrl  = event.ctrlKey;
        switch (event.type) {
            case "mousedown"       :
                event.preventDefault();
                mouse.buttonRaw |= mouse.buttons[event.which - 1];
                break;
            case "mouseup"         :
                mouse.buttonRaw &= mouse.buttons[event.which + 2];
                break;
            case "mouseout"        :
                mouse.buttonRaw = 0;
                mouse.over      = false;
                break;
            case "mouseover"       :
                mouse.over = true;
                break;
            case "mousewheel"      :
                event.preventDefault()
                mouse.w = event.wheelDelta;
                break;
            case "DOMMouseScroll"  :
                mouse.w = -event.detail;
                break;
        }

    }

    function setupMouse(e) {
        e.addEventListener('mousemove', mouseMove);
        e.addEventListener('mousedown', mouseMove);
        e.addEventListener('mouseup', mouseMove);
        e.addEventListener('mouseout', mouseMove);
        e.addEventListener('mouseover', mouseMove);
        e.addEventListener('mousewheel', function (e) {
            mouseMove(e);
            e.preventDefault();
        }, false);
        e.addEventListener('DOMMouseScroll', function (e) {
            mouseMove(e);
            e.preventDefault();
        }, false);

        e.addEventListener("contextmenu", function (e) {
            e.preventDefault();
        }, false);
    }

    // terms.
    // Real space, real, r (prefix) refers to the transformed FCanvas space.
    // c (prefix), chase is the value that chases a requiered value
    var displayTransform =
            {
                x           : 0,
                y           : 0,
                ox          : 0,
                oy          : 0,
                scale       : 1,
                rotate      : 0,
                cx          : 0,  // chase values Hold the actual display
                cy          : 0,
                cox         : 0,
                coy         : 0,
                cscale      : 1,
                crotate     : 0,
                dx          : 0,  // deltat values
                dy          : 0,
                dox         : 0,
                doy         : 0,
                dscale      : 1,
                drotate     : 0,
                drag        : 0.1,  // drag for movements
                accel       : 0.7, // acceleration
                matrix      : [0, 0, 0, 0, 0, 0], // matrix
                invMatrix   : [0, 0, 0, 0, 0, 0], // invers matrix;
                mouseX      : 0,
                mouseY      : 0,
                FContext    : FContext,
                setTransform: function () {
                    var m = this.matrix;
                    var i = 0;
                    this.FContext.setTransform(m[i++], m[i++], m[i++], m[i++], m[i++], m[i++]);
                },
                setHome     : function () {
                    this.FContext.setTransform(1, 0, 0, 1, 0, 0);

                },
                update      : function () {
                    // smooth all movement out. drag and accel control how this moves
                    // acceleration

                    this.dx += (this.x - this.cx) * this.accel;
                    this.dy += (this.y - this.cy) * this.accel;
                    this.dox += (this.ox - this.cox) * this.accel;
                    this.doy += (this.oy - this.coy) * this.accel;
                    this.dscale += (this.scale - this.cscale) * this.accel;
                    this.drotate += (this.rotate - this.crotate) * this.accel;
                    // drag

                    this.dx *= this.drag;
                    this.dy *= this.drag;
                    this.dox *= this.drag;
                    this.doy *= this.drag;
                    this.dscale *= this.drag;
                    this.drotate *= this.drag;
                    // set the chase values. Chase chases the requiered values
                    this.cx += this.dx;
                    this.cy += this.dy;
                    this.cox += this.dox;
                    this.coy += this.doy;
                    this.cscale += this.dscale;
                    this.crotate += this.drotate;

                    // create the display matrix
                    this.matrix[0] = Math.cos(this.crotate) * this.cscale;
                    this.matrix[1] = Math.sin(this.crotate) * this.cscale;
                    this.matrix[2] = -this.matrix[1];
                    this.matrix[3] = this.matrix[0];

                    // set the coords relative to the origin
                    this.matrix[4] = -(this.cx * this.matrix[0] + this.cy * this.matrix[2]) + this.cox;
                    this.matrix[5] = -(this.cx * this.matrix[1] + this.cy * this.matrix[3]) + this.coy;


                    // create invers matrix
                    var det           = (this.matrix[0] * this.matrix[3] - this.matrix[1] * this.matrix[2]);
                    this.invMatrix[0] = this.matrix[3] / det;
                    this.invMatrix[1] = -this.matrix[1] / det;
                    this.invMatrix[2] = -this.matrix[2] / det;
                    this.invMatrix[3] = this.matrix[0] / det;

                    // check for mouse. Do controls and get real position of mouse.
                    if (mouse !== undefined) {  // if there is a mouse get the real cavas coordinates of the mouse
                        if (mouse.oldX !== undefined && (mouse.buttonRaw & 1) === 1) { // check if panning (middle button)
                            var mdx = mouse.x - mouse.oldX; // get the mouse movement
                            var mdy = mouse.y - mouse.oldY;
                            // get the movement in real space
                            if (this.scale > 1.0) {
                                var mrx = (mdx * this.invMatrix[0] + mdy * this.invMatrix[2]);
                                var mry = (mdx * this.invMatrix[1] + mdy * this.invMatrix[3]);
                                this.x -= mrx;
                                this.y -= mry;
                            }

                        }
                        // do the zoom with mouse wheel
                        if (mouse.w !== undefined && mouse.w !== 0) {
                            this.ox = mouse.x;
                            this.oy = mouse.y;
                            this.x  = this.mouseX;
                            this.y  = this.mouseY;

                            if (mouse.w > 0) { // zoom in
                                this.scale *= 1.1;
                                if (this.scale > 2)
                                    this.scale = 2;
                                mouse.w -= 20;
                                if (mouse.w < 0) {
                                    mouse.w = 0;
                                }
                            }
                            if (mouse.w < 0) { // zoom out
                                this.scale *= 1 / 1.1;
                                if (this.scale <= 1.0) {
                                    this.scale  = 1.0;
                                    this.x      = 0;
                                    this.y      = 0;
                                    this.rotate = 0;
                                    this.ox     = 0;
                                    this.oy     = 0;
                                }
                                mouse.w += 20;
                                if (mouse.w > 0) {
                                    mouse.w = 0;
                                }
                            }

                        }
                        // get the real mouse position
                        var screenX = (mouse.x - this.cox);
                        var screenY = (mouse.y - this.coy);
                        this.mouseX = this.cx + (screenX * this.invMatrix[0] + screenY * this.invMatrix[2]);
                        this.mouseY = this.cy + (screenX * this.invMatrix[1] + screenY * this.invMatrix[3]);
                        mouse.rx    = this.mouseX;  // add the coordinates to the mouse. r is for real
                        mouse.ry    = this.mouseY;

                        // save old mouse position
                        mouse.oldX = mouse.x;
                        mouse.oldY = mouse.y;
                    }
                }
            }

    function update() {
        var img = null;
        if (FImgMappa != undefined) {
            img     = new Image();
            img.src = FImgMappa;
        }
        // update the transform

        displayTransform.update();

        // set home transform to clear the screem
        displayTransform.setHome();
        FContext.clearRect(0, 0, FCanvas.width, FCanvas.height);
        displayTransform.setTransform();
        if (img != null) FContext.drawImage(img, 0, 0, FCanvas.width, FCanvas.height);


        if (mouse.buttonRaw === 4) { // right click to return to home
            displayTransform.x      = 0;
            displayTransform.y      = 0;
            displayTransform.scale  = 1;
            displayTransform.rotate = 0;
            displayTransform.ox     = 0;
            displayTransform.oy     = 0;
        }
        // reaquest next frame
        FPaintCanvas();
        requestAnimationFrame(update);
    }

    function FPaintCanvas() {
        FContext.font = FONT_CARATTERI;
        var img       = null;
        if (FImgMappa != undefined) {
            img     = new Image();
            img.src = FImgMappa;
        }
        if (img == null) FContext.clearRect(0, 0, FCanvas.width, FCanvas.height);
        else FContext.drawImage(img, 0, 0, FCanvas.width, FCanvas.height);

        // Svuota lo sfondo

        if (FLarghezza == null) return;
        // Disegna i bordi
        FContext.setLineDash([0, 0]);
        FContext.strokeStyle = BORDER_COLOR;
        FContext.fillStyle   = BORDER_COLOR;
        FContext.lineWidth   = 1;
        FContext.beginPath();
        FContext.moveTo(BORDER_CANVAS, BORDER_CANVAS);
        FContext.lineTo(BORDER_CANVAS, FCanvas.height - BORDER_CANVAS);
        FContext.lineTo(FCanvas.width - BORDER_CANVAS, FCanvas.height - BORDER_CANVAS);
        FContext.lineTo(FCanvas.width - BORDER_CANVAS, BORDER_CANVAS);
        FContext.lineTo(BORDER_CANVAS, BORDER_CANVAS);
        FContext.stroke();

        // Disegna le tacche
        var TaccaPos;
        FContext.setLineDash([5, 5]);
        FContext.strokeStyle = TACCA_COLOR;
        for (TaccaPos = FTacca; TaccaPos < FLarghezza; TaccaPos += FTacca) {
            FContext.beginPath();
            FContext.moveTo(FGetVirtualXFromRealX(TaccaPos), BORDER_CANVAS);
            FContext.lineTo(FGetVirtualXFromRealX(TaccaPos), FCanvas.height - BORDER_CANVAS);
            FContext.stroke();
            FContext.fillText(TaccaPos.toFixed(1) + 'm', FGetVirtualXFromRealX(TaccaPos) + 2, FCanvas.height - BORDER_CANVAS - 5);
            FContext.closePath();
        }

        for (TaccaPos = FTacca; TaccaPos < FGetAltezza(); TaccaPos += FTacca) {
            FContext.beginPath();
            FContext.moveTo(FCanvas.width - BORDER_CANVAS, FGetVirtualYFromRealY(TaccaPos));
            FContext.lineTo(BORDER_CANVAS, FGetVirtualYFromRealY(TaccaPos));
            FContext.stroke();
            FContext.fillText(TaccaPos.toFixed(1) + 'm', BORDER_CANVAS + 2, FGetVirtualYFromRealY(TaccaPos) - 2);
            FContext.closePath();
        }

        FContext.setLineDash([0, 0]);
        // Disegna i punti impostati
        var Punto;
        for (var Segmento of FLsSegmenti) {
            if (Segmento.deleted == undefined) {
                if (FStato == STATO_EDITING) {
                    FDrawPoint(FGetVirtualXFromRealX(Segmento.X1), FGetVirtualYFromRealY(Segmento.Y1), Segmento.ColorLine1);
                    FDrawPoint(FGetVirtualXFromRealX(Segmento.X2), FGetVirtualYFromRealY(Segmento.Y2), Segmento.ColorLine2);

                }
                FDrawLine(FGetVirtualXFromRealX(Segmento.X1), FGetVirtualYFromRealY(Segmento.Y1), FGetVirtualXFromRealX(Segmento.X2), FGetVirtualYFromRealY(Segmento.Y2));

            }
        }


        if (FStato == STATO_VISUALIZZAZIONE) {
            // Disegna le ancore
            var TmpAncora = null;
            for (TmpAncora of  FLsAncore)
                if (TmpAncora != undefined)
                    if ((TmpAncora.xPos / 100 <= FLarghezza) &&
                        (TmpAncora.yPos / 100 <= FGetAltezza()) &&
                        (TmpAncora.xPos >= 0) &&
                        (TmpAncora.yPos >= 0) &&
                        (TmpAncora.Piano == FPianoAttuale)) {
                        if (TmpAncora.Raggio != 0) {
                            FContext.beginPath();
                            FContext.arc(FGetVirtualXFromRealX(TmpAncora.xPos / 100), FGetVirtualYFromRealY(TmpAncora.yPos / 100),
                                FGetVirtualXFromRealX(TmpAncora.Raggio / 100) - BORDER_CANVAS, 0, 2 * Math.PI, false);
                            FContext.fillStyle = 'rgba(246, 172, 0, 0.5)';
                            FContext.fill();
                            FContext.closePath();
                        }

                        FContext.drawImage(TmpAncora.Sbiadita ? FImageAncoraSbiadita : FImageAncora,
                            FGetVirtualXFromRealX(TmpAncora.xPos / 100) - FImageAncora.width / 2,
                            FGetVirtualYFromRealY(TmpAncora.yPos / 100) - FImageAncora.height / 2);
                    }

            for (var j in FLsAncore) {
                if (FPianoAttuale == FLsAncore[j].Piano) {
                    FContext.beginPath();
                    FContext.fillStyle = "black";
                    FContext.fillText(j, FGetVirtualXFromRealX(FLsAncore[j].xPos / 100) - 3, FGetVirtualYFromRealY(FLsAncore[j].yPos / 100) - 15);

                    FContext.fill();
                    FContext.closePath();
                }
            }

            // Disegna le videocamere
            var TmpVideocamera = null;
            for (TmpVideocamera of  FLsVideocamere)
                if (TmpVideocamera != undefined)
                    if ((TmpVideocamera.xPos / 100 <= FLarghezza) &&
                        (TmpVideocamera.yPos / 100 <= FGetAltezza()) &&
                        (TmpVideocamera.xPos >= 0) &&
                        (TmpVideocamera.yPos >= 0) &&
                        (TmpVideocamera.Piano == FPianoAttuale))
                        FContext.drawImage(FImageVideocamera,
                            FGetVirtualXFromRealX(TmpVideocamera.xPos / 100) - FImageVideocamera.width / 2,
                            FGetVirtualYFromRealY(TmpVideocamera.yPos / 100) - FImageVideocamera.height / 2);

            // Disegna i fari sulla cartina
            if (FGoogleMapMode) {
                var SomeChange = false;
                for (i = 1; i < FLsFari.length; i++)
                    if (FLsFari[i] != undefined)
                        if (((FLsFari[i].Longitudine != 0) || (FLsFari[i].Latitudine != 0)) &&
                            (!FLsFari[i].RadioSwitchedOff)) {
                            let AddMarker = FGoogleMarkers[i] == undefined;
                            if (!AddMarker) {
                                let OldPos = FGoogleMarkers[i].getPosition();
                                if ((OldPos.lat().toFixed(7) != FLsFari[i].Latitudine.toFixed(7)) ||
                                    (OldPos.lng().toFixed(7) != FLsFari[i].Longitudine.toFixed(7)) ||
                                    (FGoogleMarkers[i].InAllarme != SomeFaroAlarmActive(FLsFari[i]))) {
                                    FGoogleMarkers[i].setMap(null);
                                    FGoogleMarkers[i] = undefined;
                                    if (FGoogleClusterMarker != null) {
                                        FGoogleClusterMarker.clearMarkers();
                                        FGoogleClusterMarker = null;
                                    }
                                    AddMarker = true;
                                }
                            }
                            if (AddMarker) {
                                SomeChange    = true;
                                var pinSymbol = function (color) {
                                    return {
                                        path        : 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                                        fillColor   : color,
                                        fillOpacity : 1,
                                        strokeColor : '#000',
                                        strokeWeight: 2,
                                        scale       : 1
                                    };

                                }

                                FGoogleMarkers[i]           = new google.maps.Marker({
                                    position: {lat: FLsFari[i].Latitudine, lng: FLsFari[i].Longitudine},
                                    map     : GlobalGoogleMap,
                                    //label     : i.toString(),
                                    icon    : pinSymbol(SomeFaroAlarmActive(FLsFari[i]) ? 'red' : 'green')
                                });
                                FGoogleMarkers[i].InAllarme = SomeFaroAlarmActive(FLsFari[i]);
                                FGoogleMarkers[i].addListener('click', function (IndexFaro) {
                                    return (function () {
                                        ShowMessage(function () {
                                            return ("<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left;padding-top:8px\">Allarmi</div><div>" + GetFaroIconAlarm(FLsFari[IndexFaro]) + "</div></div>" +
                                                "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Nome</div><div>" + FLsFari[IndexFaro].Nome + "</div></div>" +
                                                "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">WeTAG</div><div>" + IndexFaro + "</div></div>" +
                                                "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Piano</div><div>" + FLsFari[IndexFaro].Piano + "</div></div>" +
                                                "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">MAC</div><div>" + FLsFari[IndexFaro].Mac + "</div></div>" +
                                                "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Ancora rif.</div><div>" + FLsFari[IndexFaro].AncoraRif + "</div></div>" +
                                                "<div style=\"clear:both\">" +
                                                "<div style=\"font-weight:bold;width:30%;float:left\">&nbsp</div>" +
                                                "<div>" +
                                                "<img class=\"callMeButton\" CallMe=\"1\" MacTag=\"" + FLsFari[IndexFaro].Mac + "\" src=\"BtnCallMe.png\">" +
                                                "</div>" +
                                                "</div>"
                                            );
                                        });
                                    });
                                }(i));
                            }
                        }
                for (i = 1; i < FLsFari.length; i++)
                    if (FLsFari[i] != undefined)
                        if ((((FLsFari[i].Longitudine == 0) && (FLsFari[i].Latitudine == 0)) || (FLsFari[i].RadioSwitchedOff)) &&
                            (FGoogleMarkers[i] != undefined)) {
                            FGoogleMarkers[i].setMap(null);
                            FGoogleMarkers[i] = undefined;
                            if (FGoogleClusterMarker != null) {
                                FGoogleClusterMarker.clearMarkers();
                                FGoogleClusterMarker = null;
                            }
                            SomeChange = true;
                        }
                if (SomeChange)
                    if ((FGoogleClusterMarker == null) && (FGoogleMarkers.length != 0)) {
                        var TmpMarkers = [];
                        FGoogleMarkers.forEach(function (AMarker) {
                            if (AMarker != undefined) TmpMarkers.push(AMarker);
                        });
                        FGoogleClusterMarker = new MarkerClusterer(GlobalGoogleMap, TmpMarkers, {
                            imagePath     : "MarkerClusterer/m",
                            imagePathAlarm: "MarkerClusterer/mA"
                        });
                    }
            }

            // Disegna i fari
            var i;
            var index;
            var FariPosUguali  = [];
            var AttributiArray = [];
            var conta          = [];

            for (i = 1; i < FLsFari.length; i++)
                if (FLsFari[i] != undefined)
                    FLsFari[i].Coincidente = false;

            FLsCumulativi = [];

            for (i = 1; i < FLsFari.length; i++)
                if (FLsFari[i] != undefined) {
                    if ((FLsFari[i].xPos / 100 <= FLarghezza) &&
                        (FLsFari[i].yPos / 100 <= FGetAltezza()) &&
                        (FLsFari[i].xPos >= 0) &&
                        (FLsFari[i].yPos >= 0) &&
                        (!FLsFari[i].Coincidente) &&
                        (FLsFari[i].Piano == FPianoAttuale) &&
                        CanDrawFaroOnCanvas(FLsFari[i])) {

                        var AllarmePresente = function (AFaro) {
                            return ((AFaro.Batteria != "0") || (AFaro.Cintura != "0") || (AFaro.Fune != "0") ||
                                (AFaro.Guanti != "0") || (AFaro.Scarpe != "0") || (AFaro.UomoATerra != "0") ||
                                (AFaro.Elmetto != "0"));
                        };

                        var SegnalazionePresente = function (AFaro) {
                            return ((AFaro.CallMeAlarm != "0") || (AFaro.EvacuationAlarm != "0"));
                        }

                        var TmpText = '';

                        function drawCircle() {

                            FContext.beginPath();
                            FContext.globalAlpha = 1;
                            FContext.arc(FGetVirtualXFromRealX(FLsFari[i].xPos / 100), FGetVirtualYFromRealY(FLsFari[i].yPos / 100), WIDTH_TAG, 0, Math.PI * 2, true);
                            if ((FLsFari[i].MandownDisabilitato == 1) || (FLsFari[i].MandownTacitato == 1))
                                FLsFari[i].UomoATerra = 0;
                            if (FLsFari[i].FuoriCampo)
                                FContext.fillStyle = COLOR_FUORI_CAMPO;
                            else {
                                if (AllarmePresente(FLsFari[i])) FContext.fillStyle = COLOR_ALLARME;
                                else FContext.fillStyle = SegnalazionePresente(FLsFari[i]) ? COLOR_SEGNALAZIONE : COLOR_NO_PROBLEM;
                            }
                            FContext.strokeStyle = COLOR_BORDER_ICONE;
                            FContext.lineWidth   = 2;
                            FContext.fill();
                            FContext.stroke();
                            FContext.closePath();
                            TmpText = "";
                        };

                        var Riassunto = {
                            Elmetto            : FLsFari[i].Elmetto,
                            xPos               : parseInt(FLsFari[i].xPos),
                            yPos               : parseInt(FLsFari[i].yPos),
                            Count              : 1,
                            Batteria           : FLsFari[i].Batteria,
                            Cintura            : FLsFari[i].Cintura,
                            Fune               : FLsFari[i].Fune,
                            Guanti             : FLsFari[i].Guanti,
                            CountFuoriCampo    : (FLsFari[i].FuoriCampo ? 1 : 0),
                            MandownTacitato    : FLsFari[i].MandownTacitato,
                            MandownDisabilitato: FLsFari[i].MandownDisabilitato,
                            Scarpe             : FLsFari[i].Scarpe,
                            Nome               : FLsFari[i].Nome,
                            UomoATerra         : FLsFari[i].UomoATerra,
                            CountAllarmi       : (AllarmePresente(FLsFari[i]) && (!FLsFari[i].FuoriCampo) ? 1 : 0),
                            CountSegnalazioni  : (SegnalazionePresente(FLsFari[i]) && (!FLsFari[i].FuoriCampo) ? 1 : 0),
                            LsTags             : [i]
                        };


                        for (index = i + 1; index < FLsFari.length; index++) {
                            if (FLsFari[index] != undefined) {
                                if (CanDrawFaroOnCanvas(FLsFari[index]) &&
                                    (FLsFari[i].Piano == FLsFari[index].Piano)) {
                                    if (!(parseInt(FLsFari[i].xPos) > parseInt(FLsFari[index].xPos) + (FGetRealWidthXFromVirtualX(WIDTH_TAG) * 100) ||
                                        parseInt(FLsFari[i].xPos) < parseInt(FLsFari[index].xPos) - (FGetRealWidthXFromVirtualX(WIDTH_TAG) * 100) ||
                                        parseInt(FLsFari[i].yPos) > parseInt(FLsFari[index].yPos) + (FGetRealHeightYFromVirtualY(WIDTH_TAG) * 100) ||
                                        parseInt(FLsFari[i].yPos) < parseInt(FLsFari[index].yPos) - (FGetRealHeightYFromVirtualY(WIDTH_TAG) * 100))) {
                                        FLsFari[index].Coincidente = true;
                                        FLsFari[i].Coincidente     = true;
                                        Riassunto.xPos += parseInt(FLsFari[index].xPos);
                                        Riassunto.yPos += parseInt(FLsFari[index].yPos);
                                        Riassunto.Count++;
                                        Riassunto.Batteria |= (FLsFari[index].Batteria != 0);
                                        Riassunto.Cintura |= (FLsFari[index].Cintura != 0);
                                        Riassunto.Fune |= (FLsFari[index].Fune != 0);
                                        Riassunto.Guanti |= (FLsFari[index].Guanti != 0);
                                        Riassunto.Scarpe |= (FLsFari[index].Scarpe != 0);
                                        Riassunto.MandownDisabilitato |= (FLsFari[index].MandownDisabilitato != 0);
                                        Riassunto.MandownTacitato |= (FLsFari[index].MandownTacitato != 0);
                                        Riassunto.UomoATerra |= (FLsFari[index].UomoATerra != 0);
                                        Riassunto.Nome += FLsFari[index].Nome;
                                        Riassunto.Elmetto |= (FLsFari[index].Elmetto != 0);
                                        Riassunto.FuoriCampo |= FLsFari[index].FuoriCampo;
                                        if (FLsFari[index].FuoriCampo)
                                            Riassunto.CountFuoriCampo++;
                                        else {
                                            if (AllarmePresente(FLsFari[index])) Riassunto.CountAllarmi++;
                                            if (SegnalazionePresente(FLsFari[index])) Riassunto.CountSegnalazioni++;
                                        }
                                        Riassunto.LsTags.push(index);
                                    }
                                }
                            }
                        }

                        if (Riassunto.Count > 1) {
                            Riassunto.xPos = Math.round(Riassunto.xPos / Riassunto.Count);
                            Riassunto.yPos = Math.round(Riassunto.yPos / Riassunto.Count);
                        }


                        if (!FLsFari[i].Coincidente)
                            drawCircle();
                        else {
                            FLsCumulativi.push(Riassunto);
                            TmpText    = Riassunto.Count;
                            var Colori = [];
                            if (Riassunto.CountFuoriCampo > 0)
                                Colori.push(COLOR_FUORI_CAMPO);
                            if (Riassunto.CountAllarmi > 0)
                                Colori.push(COLOR_ALLARME)
                            else {
                                if (Riassunto.CountSegnalazioni > 0) Colori.push(COLOR_SEGNALAZIONE);
                            }
                            if (Riassunto.CountAllarmi + Riassunto.CountFuoriCampo + Riassunto.CountSegnalazioni < Riassunto.Count)
                                Colori.push(COLOR_NO_PROBLEM);

                            switch (Colori.length) {
                                case 1 :
                                    FContext.beginPath();
                                    FContext.fillStyle = Colori.pop();
                                    FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100) - WIDTH_TAG,
                                        FGetVirtualYFromRealY(Riassunto.yPos / 100) - WIDTH_TAG,
                                        WIDTH_TAG * 2, WIDTH_TAG * 2);
                                    FContext.fill();
                                    FContext.closePath();
                                    break;
                                case 2 :
                                    FContext.beginPath();
                                    FContext.fillStyle = Colori.pop();
                                    FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100) - WIDTH_TAG,
                                        FGetVirtualYFromRealY(Riassunto.yPos / 100) - WIDTH_TAG,
                                        WIDTH_TAG, WIDTH_TAG * 2);
                                    FContext.fill();
                                    FContext.closePath();
                                    FContext.beginPath();
                                    FContext.fillStyle = Colori.pop();
                                    FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100),
                                        FGetVirtualYFromRealY(Riassunto.yPos / 100) - WIDTH_TAG,
                                        WIDTH_TAG, WIDTH_TAG * 2);
                                    FContext.fill();
                                    FContext.closePath();
                                    break;
                                case 3 :
                                    FContext.beginPath();
                                    FContext.fillStyle = Colori.pop();
                                    FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100) - WIDTH_TAG,
                                        FGetVirtualYFromRealY(Riassunto.yPos / 100) - WIDTH_TAG,
                                        WIDTH_TAG * 2, WIDTH_TAG);
                                    FContext.fill();
                                    FContext.closePath();
                                    FContext.beginPath();
                                    FContext.fillStyle = Colori.pop();
                                    FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100) - WIDTH_TAG,
                                        FGetVirtualYFromRealY(Riassunto.yPos / 100),
                                        WIDTH_TAG, WIDTH_TAG);
                                    FContext.fill();
                                    FContext.closePath();
                                    FContext.beginPath();
                                    FContext.fillStyle = Colori.pop();
                                    FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100),
                                        FGetVirtualYFromRealY(Riassunto.yPos / 100),
                                        WIDTH_TAG, WIDTH_TAG);
                                    FContext.fill();
                                    FContext.closePath();
                                    break;
                            }
                            FContext.beginPath();
                            FContext.rect(FGetVirtualXFromRealX(Riassunto.xPos / 100) - 15, FGetVirtualYFromRealY(Riassunto.yPos / 100) - 15, 30, 30);
                            FContext.strokeStyle = COLOR_BORDER_ICONE;
                            FContext.lineWidth   = 2;
                            FContext.stroke();
                            FContext.closePath();
                        }
                        if (Text != "") {
                            FContext.font      = "bold 11px Arial";
                            FContext.fillStyle = "white";
                            FContext.fillText(TmpText,
                                FGetVirtualXFromRealX(Riassunto.xPos / 100) - 15 + (30 - FContext.measureText(TmpText).width) / 2,
                                FGetVirtualYFromRealY(Riassunto.yPos / 100) + 4);
                            FContext.font = FONT_CARATTERI;
                        }
                    }
                }
        }
        // Disegna il segmento in inserimento
        if (FStartPoint != null) {
            FDrawPoint(FGetVirtualXFromRealX(FStartPoint.X), FGetVirtualYFromRealY(FStartPoint.Y));
            if (FEndPoint != null) {
                FDrawLine(FGetVirtualXFromRealX(FStartPoint.X), FGetVirtualYFromRealY(FStartPoint.Y),
                    FGetVirtualXFromRealX(FEndPoint.X), FGetVirtualYFromRealY(FEndPoint.Y));
                FDrawPoint(FGetVirtualXFromRealX(FEndPoint.X), FGetVirtualYFromRealY(FEndPoint.Y));
            }
        }

        if (FPosAncora != null &&
            FPianoAttuale == FLsAncore[FIdAncora].Piano &&
            FStato == STATO_EDITING &&
            FIdAncora == document.getElementById("NomeAncora").value)
            FContext.drawImage(FImageAncora, FGetVirtualXFromRealX(FPosAncora.X) - 12, FGetVirtualYFromRealY(FPosAncora.Y) - 12);
    }

    function ChangeModeView(ViewGoogleMap, Latitudine, Longitudine) {
        document.getElementById('divCanvas').style.display    = (ViewGoogleMap ? "none" : "block");
        document.getElementById('divGoogleMap').style.display = (ViewGoogleMap ? "block" : "none");
        FGoogleMapMode                                        = ViewGoogleMap;
        if (ViewGoogleMap) {
            GlobalGoogleMap.setCenter({lat: Latitudine, lng: Longitudine});
            GlobalGoogleMap.setZoom(15);
        }
    }

    function FOnClickConfermaFaroDaTrovare() {
        var SelectFaro = document.getElementById('FaroSelezionato');
        if (SelectFaro.selectedIndex != -1) {
            var FaroRicercato = FLsFari.find(function (SingoloFaro) {
                if (SingoloFaro != undefined)
                    return (SingoloFaro.Nome == SelectFaro.options[SelectFaro.selectedIndex].text);
            });
            if (FaroRicercato == undefined)
                FPianoAttuale = FLsFari[SelectFaro.options[SelectFaro.selectedIndex].text].Piano;
            else FPianoAttuale = FaroRicercato.Piano;
            if ((FaroRicercato.Latitudine != 0) || (FaroRicercato.Longitudine != 0))
                ChangeModeView(true, FaroRicercato.Latitudine, FaroRicercato.Longitudine)
            else {
                FChangePiano();
                FPaintCanvas();
            }
            FChangeStato(STATO_VISUALIZZAZIONE);
        }

    }

    function FOnClickBtnConfermaPianoSelezionato() {
        var SelectPiano = document.getElementById('PianoSelezionato');
        if (SelectPiano.selectedIndex != -1)
            FPianoAttuale = SelectPiano.options[SelectPiano.selectedIndex].value;
        FChangePiano();
        FPaintCanvas();
        FChangeStato(STATO_VISUALIZZAZIONE);
    }

    function addEventListenerByClass(className, event, fn) {
        var list = document.getElementsByClassName(className);
        for (var i = 0, len = list.length; i < len; i++) {
            list[i].addEventListener(event, fn, false);
        }
    }

    function FGetListaAncore() {
        var ListaAncoreOnline  = "";
        var ListaAncoreOffline = "";
        for (var Ancora of FLsAncore)
            if (Ancora != undefined) {
                let TextAncora = "<div style=\"clear:both;font-weight:bold\">" + Ancora.Nome + "</div></div>" +
                    "<div style=\"clear:both\"><div style=\"width:30%;float:left\">Edificio</div><div>" + Ancora.Building + "</div></div>" +
                    "<div style=\"clear:both\"><div style=\"width:30%;float:left\">Zona</div><div>" + Ancora.Zone + "</div></div>" +
                    "<div style=\"clear:both\"><div style=\"width:30%;float:left\">Piano</div><div>" + Ancora.Piano + "</div></div>" +
                    "<div style=\"clear:both;height:5px;\">&nbsp</div>";
                if (Ancora.Sbiadita) ListaAncoreOffline += TextAncora;
                else ListaAncoreOnline += TextAncora;
            }
        if (ListaAncoreOffline == "") ListaAncoreOffline = 'Nessuna ancora offline';
        if (ListaAncoreOnline == "") ListaAncoreOnline = 'Nessuna ancora online';
        return ("<div style=\"height:30px;clear:both;background:#FCBF2F;color:white;text-align:center;font-weight:bold;padding-top:5px\">Ancore offline</div><div style=\"height:5px\"></div>" +
            ListaAncoreOffline +
            "<div style=\"height:30px;clear:both;background:#FCBF2F;color:white;text-align:center;font-weight:bold;padding-top:5px\">Ancore online</div><div style=\"height:5px\"></div>" +
            ListaAncoreOnline);
    }

    function FGetListaTag() {
        var ListaFariOnline     = "";
        var ListaFariOffline    = "";
        var ListaFariFuoriCampo = "";
        for (var Faro of FLsFari)
            if (Faro != undefined) {
                let TextFaro = "<div style=\"clear:both;\">" + Faro.Nome + "</div></div>" +
                    "<div style=\"clear:both;height:5px;\">&nbsp</div>";
                if (Faro.RadioSwitchedOff)
                    ListaFariOffline += TextFaro;
                else {
                    if (Faro.FuoriCampo) ListaFariFuoriCampo += TextFaro;
                    else ListaFariOnline += TextFaro;
                }
            }
        if (ListaFariFuoriCampo == "") ListaFariFuoriCampo = 'Nessun WeTAG fuori campo';
        if (ListaFariOffline == "") ListaFariOffline = 'Nessun WeTAG offline';
        if (ListaFariOnline == "") ListaFariOnline = 'Nessun WeTAG online';
        return ("<div style=\"height:30px;clear:both;background:#FCBF2F;color:white;text-align:center;font-weight:bold;padding-top:5px\">WeTAG offline</div><div style=\"height:5px\"></div>" +
            ListaFariOffline +
            "<div style=\"height:30px;clear:both;background:#FCBF2F;color:white;text-align:center;font-weight:bold;padding-top:5px\">WeTAG fuori campo</div><div style=\"height:5px\"></div>" +
            ListaFariFuoriCampo +
            "<div style=\"height:30px;clear:both;background:#FCBF2F;color:white;text-align:center;font-weight:bold;padding-top:5px\">WeTAG online</div><div style=\"height:5px\"></div>" +
            ListaFariOnline);
    }

    function SomeFaroAlarmActive(AFaro) {
        return ((AFaro.Elmetto == 1) || (AFaro.Guanti == 1) ||
            (AFaro.Batteria == 1) || (AFaro.UomoATerra == 1) ||
            (AFaro.Fune == 1) || (AFaro.Scarpe == 1) ||
            (AFaro.Cintura == 1) || (AFaro.FuoriCampo));
    }

    function GetFaroIconAlarm(Oggetto) {
        var Result = "";
        if (Oggetto.FuoriCampo)
            Result = '<img src="FuoriCampo.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
        else {
            if (Oggetto.Elmetto == 1) Result += '<img src="Elmetto.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.Guanti == 1) Result += '<img src="Guanto.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.Batteria == 1) Result += '<img src="Batteria.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.UomoATerra == 1) Result += '<img src="UomoATerra.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.Fune == 1) Result += '<img src="Fune.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.Scarpe == 1) Result += '<img src="Scarpa.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.Cintura == 1) Result += '<img src="Cintura.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.CallMeAlarm == 1) Result += '<img src="CallMeR.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;';
            if (Oggetto.EvacuationAlarm == 1) Result += '<img src="EvacStart.png" style="width:30px;height:30px;"/>&nbsp;&nbsp;&nbsp;&nbsp;'
        }
        return (Result);
    }

    function OpenVideoCamera(Videocamera) {
        ShowMessage(function () {
            return ("<div style=\"text-align:center\">" +
                " <video autoplay=\"\" style=\"width:70%;height:60%\" preload=\"none\" id=\"appletNnvr-b-32-c71703678153\">" +
                "    <source src=\"https://" + Videocamera.IpAddress + "/api/aivu_dvs/v1/live/" + Videocamera.NVR + "/" +
                Videocamera.Camera + "/webm?size=small&amp;format=4&amp;osd=off&amp;_=1509461477197&username=" + Videocamera.User +
                "&password=" + Videocamera.Pwd + "\" type=\"video/webm\">" +
                "</video>" +
                "</div>");
        });
    }

    function FOnClickCanvas(e) {
        var event    = window.event || e;
        var PosX     = event.offsetX;
        var PosY     = event.offsetY;
        var RealPosX = FGetRealXFromVirtualX(mouse.rx);
        var RealPosY = FGetRealYFromVirtualY(mouse.ry);

        function GetPuntoVicino(PuntoVicino) {
            switch (PuntoVicino.Punto) {
                case 1:
                    return ({X: FLsSegmenti[PuntoVicino.index].X1, Y: FLsSegmenti[PuntoVicino.index].Y1});
                case 2:
                    return ({X: FLsSegmenti[PuntoVicino.index].X2, Y: FLsSegmenti[PuntoVicino.index].Y2});
            }
            return (null);
        }

        var Coinc         = [];
        var ElencoAllarmi = "";

        if (FStato != STATO_EDITING) {
            var FoundElemento = false;
            for (var Riassunto of FLsCumulativi)
                if (!(RealPosX * 100 > parseInt(Riassunto.xPos) + (FGetRealWidthXFromVirtualX(WIDTH_TAG) * 100) ||
                    RealPosX * 100 < parseInt(Riassunto.xPos) - (FGetRealWidthXFromVirtualX(WIDTH_TAG) * 100) ||
                    RealPosY * 100 > parseInt(Riassunto.yPos) + (FGetRealHeightYFromVirtualY(WIDTH_TAG) * 100) ||
                    RealPosY * 100 < parseInt(Riassunto.yPos) - (FGetRealHeightYFromVirtualY(WIDTH_TAG) * 100))) {
                    ElencoAllarmi = "";
                    for (var IdFaro of Riassunto.LsTags) {
                        let AFaro     = FLsFari[IdFaro];
                        ElencoAllarmi += "<div style=\"clear:both;padding-top:3px;font-weight:bold;height:20px;background:#FCBF2F;color:white;text-align:center\">" + AFaro.Nome + "</div>" +
                            "<div style=\"clear:both;height:4px\">&nbsp</div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left;padding-top:8px\">Allarmi</div><div>" + GetFaroIconAlarm(AFaro) + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">WeTAG</div><div>" + IdFaro + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Piano</div><div>" + AFaro.Piano + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">MAC</div><div>" + AFaro.Mac + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Ancora rif.</div><div>" + AFaro.AncoraRif + "</div></div>" +
                            "<div style=\"clear:both\">" +
                            "<div style=\"font-weight:bold;width:30%;float:left\">&nbsp</div>" +
                            "<div style=\"float:left;text-align:left;padding-top:5px;\" >" +
                            "<img class=\"callMeButton\" CallMe=\"1\" MacTag=\"" + AFaro.Mac + "\" src=\"BtnCallMe.png\">" +
                            "</div></div>" +
                            "<div style=\"clear:both;height:8px\">&nbsp</div>";
                        FoundElemento = true;
                    }
                }

            var SetAlarmButton = function () {
                var Pulsanti = document.querySelectorAll(".callMeButton");
                for (var i = 0; i < Pulsanti.length; i++) {
                    Pulsanti[i].addEventListener('click', function (event) {
                        FConnessione.send('ADVICE_TO_TAG~' +
                            (this.getAttribute('CallMe') != 0 ? ALARM_TAG_CALL_ME : ALARM_TAG_RESET_CALLME).toString() + '~' +
                            this.getAttribute('MacTag'));
                        this.src = (this.getAttribute('CallMe') != 0 ? "BtnStopAlarm.png" : "BtnCallMe.png");
                        this.setAttribute('CallMe', (this.getAttribute('CallMe') != 0 ? "0" : "1"));
                    });
                }
            };

            if (FoundElemento) ShowMessage(function () {
                    return (ElencoAllarmi);
                },
                SetAlarmButton);

            if (!FoundElemento)
                for (var j = 1; j < FLsFari.length; j++)
                    if (FLsFari[j] != undefined)
                        if ((FLsFari[j].Piano == FPianoAttuale) && (CanDrawFaroOnCanvas(FLsFari[j])))
                            if (!(parseInt(FLsFari[j].xPos) / 100 > RealPosX + (FGetRealWidthXFromVirtualX(WIDTH_TAG)) ||
                                parseInt(FLsFari[j].xPos) / 100 < RealPosX - (FGetRealWidthXFromVirtualX(WIDTH_TAG)) ||
                                parseInt(FLsFari[j].yPos) / 100 > RealPosY + (FGetRealHeightYFromVirtualY(WIDTH_TAG)) ||
                                parseInt(FLsFari[j].yPos) / 100 < RealPosY - (FGetRealHeightYFromVirtualY(WIDTH_TAG)))) {
                                FoundElemento = true;
                                ShowMessage(function () {
                                    return ("<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left;padding-top:8px\">Allarmi</div><div>" + GetFaroIconAlarm(FLsFari[j]) + "</div></div>" +
                                        "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Nome</div><div>" + FLsFari[j].Nome + "</div></div>" +
                                        "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">WeTAG</div><div>" + j + "</div></div>" +
                                        "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Piano</div><div>" + FLsFari[j].Piano + "</div></div>" +
                                        "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">MAC</div><div>" + FLsFari[j].Mac + "</div></div>" +
                                        "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Ancora rif.</div><div>" + FLsFari[j].AncoraRif + "</div></div>" +
                                        "<div style=\"clear:both\">" +
                                        "<div style=\"font-weight:bold;width:30%;float:left\">&nbsp</div>" +
                                        "<div>" +
                                        "<img class=\"callMeButton\" CallMe=\"1\" MacTag=\"" + FLsFari[j].Mac + "\" src=\"BtnCallMe.png\">" +
                                        "</div>" +
                                        "</div>"
                                    );
                                }, SetAlarmButton);
                                break;
                            }

            if (!FoundElemento)
                for (var k = 0; k < FLsVideocamere.length; k++) {
                    if (FLsVideocamere[k] != undefined)
                        if (FLsVideocamere[k].Piano == FPianoAttuale)
                            if (!(parseInt(FLsVideocamere[k].xPos) / 100 > RealPosX + (FGetRealWidthXFromVirtualX(WIDTH_TAG)) ||
                                parseInt(FLsVideocamere[k].xPos) / 100 < RealPosX - (FGetRealWidthXFromVirtualX(WIDTH_TAG)) ||
                                parseInt(FLsVideocamere[k].yPos) / 100 > RealPosY + (FGetRealHeightYFromVirtualY(WIDTH_TAG)) ||
                                parseInt(FLsVideocamere[k].yPos) / 100 < RealPosY - (FGetRealHeightYFromVirtualY(WIDTH_TAG)))) {
                                OpenVideoCamera(FLsVideocamere[k]);
                            }
                }

            if (!FoundElemento)
                for (var k = 0; k < FLsAncore.length; k++) {
                    if (FLsAncore[k].Piano == FPianoAttuale)
                        if (!(parseInt(FLsAncore[k].xPos) / 100 > RealPosX + (FGetRealWidthXFromVirtualX(WIDTH_TAG)) ||
                            parseInt(FLsAncore[k].xPos) / 100 < RealPosX - (FGetRealWidthXFromVirtualX(WIDTH_TAG)) ||
                            parseInt(FLsAncore[k].yPos) / 100 > RealPosY + (FGetRealHeightYFromVirtualY(WIDTH_TAG)) ||
                            parseInt(FLsAncore[k].yPos) / 100 < RealPosY - (FGetRealHeightYFromVirtualY(WIDTH_TAG)))) {
                            ShowMessage(function () {
                                return ("<div><div style=\"font-weight:bold;width:30%;float:left\">Nome</div><div>" + FLsAncore[k].Nome + "</div></div>" +
                                    "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">IP</div><div>" + FLsAncore[k].Ip + "</div></div>" +
                                    "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Zona</div><div>" + FLsAncore[k].Zone + "</div></div>" +
                                    "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Edificio</div><div>" + FLsAncore[k].Building + "</div></div>" +
                                    "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">MAC</div><div>" + FLsAncore[k].Mac + "</div></div>" +
                                    "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Tipologia</div><div>" + (FLsAncore[k].Proximity ? "Proximity" : "Finger printer") + "</div></div>" +
                                    "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Soglie RSSI</div><div>" + (FLsAncore[k].Rssi - 255) + "dBm</div></div>");
                            });
                        }
                }
        }

        if (FModalita == ADDANCORA) {
            if ((document.getElementById("NomeAncora").value >= 0) && (document.getElementById("NomeAncora").value <= FLsAncore.length)) {
                var Ancore = '';
                FPosAncora = {X: RealPosX, Y: RealPosY};
                FIdAncora  = document.getElementById("NomeAncora").value;
                Ancore += document.getElementById("NomeAncora").value + ',' +
                    FPosAncora.X * 100 + ',' +
                    FPosAncora.Y * 100 + ',' +
                    FLsAncore[FIdAncora].zPos + ',' +
                    FPianoAttuale + ',' +
                    FLsAncore[FIdAncora].Raggio + ',' +
                    FLsAncore[FIdAncora].Zone + ',' +
                    FLsAncore[FIdAncora].Nome + ',' +
                    FLsAncore[FIdAncora].Ip + ',' +
                    FLsAncore[FIdAncora].Rssi + ',' +
                    (FLsAncore[FIdAncora].Proximity ? '1' : '0');
                FAncoreDaRegistrare.push(Ancore);
            }
        }

        if (FStato != STATO_EDITING) return;

        if (FModalita != ADDANCORA)
            if ((RealPosX >= 0) && (RealPosY >= 0)) {
                var PuntoVicino = FGetNearestPoint(mouse.rx, mouse.ry);
                if (FModalita == TRK_ERASE_POINT) {
                    var PuntoVicino = GetPuntoVicino(PuntoVicino);
                    if (PuntoVicino != null) {
                        for (var ASegmento of FLsSegmenti) {
                            if ((ASegmento.X1 == PuntoVicino.X) && (ASegmento.Y1 == PuntoVicino.Y) ||
                                (ASegmento.X2 == PuntoVicino.X) && (ASegmento.Y2 == PuntoVicino.Y)) ASegmento.deleted = true;
                            FPaintCanvas();
                        }
                    }
                } else {
                    if (FStartPoint == null) {
                        if (PuntoVicino == null)
                            FStartPoint = {X: RealPosX, Y: RealPosY};
                        else FStartPoint = GetPuntoVicino(PuntoVicino);
                        FPaintCanvas();
                    } else {
                        if (PuntoVicino != null)
                            FEndPoint = GetPuntoVicino(PuntoVicino);
                        FLsSegmenti.push({
                            X1        : FStartPoint.X,
                            Y1        : FStartPoint.Y,
                            X2        : FEndPoint.X,
                            Y2        : FEndPoint.Y,
                            ColorLine1: FColorLine,
                            ColorLine2: FColorLine
                        });
                        FEndPoint   = null;
                        FStartPoint = null;
                        FPaintCanvas();
                    }
                }
            }
    }

    function FOnSavePoints() {
        var Segmenti = '';
        for (var ASegmento of FLsSegmenti) {
            if (ASegmento.deleted == undefined) {
                if (Segmenti != '') Segmenti += '^';
                Segmenti += (ASegmento.X1 * 10).toFixed(0) + ',' +
                    (ASegmento.Y1 * 10).toFixed(0) + ',' +
                    (ASegmento.X2 * 10).toFixed(0) + ',' +
                    (ASegmento.Y2 * 10).toFixed(0);
            }
        }
        FConnessione.send('SETPOINTS~' + FPianoAttuale + '~' + FLarghezza * 100 + '~' + FTacca * 100 + '~' + Segmenti + '~' + FNomePiano + '~' + FImgMappa);


    }


    function FTranslatePunti(Larghezza, Tacca, Punti, nome_piano, img_mappa) {
        var ArraySegmenti;
        var ArrayPunti;
        var TmpSegment;

        FLsSegmenti = [];

        try {
            FLarghezza = Larghezza / 100;
        } catch (E) {
            FLarghezza = 10;
        }
        if (!FLarghezza) FLarghezza = 10;
        try {
            FTacca = Tacca / 100;
        } catch (E) {
            FTacca = 1;
        }
        if (!FTacca) FTacca = 1;
        FNomePiano = nome_piano;
        FImgMappa  = img_mappa;
        if (Punti != undefined) {
            ArraySegmenti = Punti.split('^');
            for (TmpSegment of ArraySegmenti) {
                ArrayPunti = TmpSegment.split(',');
                FLsSegmenti.push({
                    X1        : ArrayPunti[0] / 10,
                    Y1        : ArrayPunti[1] / 10,
                    X2        : ArrayPunti[2] / 10,
                    Y2        : ArrayPunti[3] / 10,
                    ColorLine1: FColorLine,
                    ColorLine2: FColorLine
                });
                ArrayPunti = null;
            }
            ArraySegmenti = null;
        }
        FPaintCanvas();
    }

    function FOnMouseMoveCanvas(e) {
        var event    = window.event || e;
        var RealPosX = FGetRealXFromVirtualX(mouse.rx);
        var RealPosY = FGetRealYFromVirtualY(mouse.ry);


        document.getElementById('mapXPos').innerHTML = RealPosX == -1 ? '--' : RealPosX.toFixed(1) + 'm';
        document.getElementById('mapYPos').innerHTML = RealPosY == -1 ? '--' : RealPosY.toFixed(1) + 'm';


        if ((RealPosX >= 0) && (RealPosY >= 0)) {
            var ForcePaint = false;

            if (FStartPoint != null) {
                // Imposta il secondo punto del segmento in modifica.
                switch (FModalita) {
                    case TRK_LINE_HORIZONTAL :
                        FEndPoint = {X: RealPosX, Y: FStartPoint.Y};
                        break;
                    case TRK_LINE_NORMAL     :
                        FEndPoint = {X: RealPosX, Y: RealPosY};
                        break;
                    case TRK_LINE_VERTICAL :
                        FEndPoint = {X: FStartPoint.X, Y: RealPosY};
                        break;


                }
                ForcePaint = true;
            }
            // Annerisce i punti in evidenza
            var Punto;
            for (Punto of FLsSegmenti) {
                if (Punto.ColorLine1 != FColorLine) {
                    Punto.ColorLine1 = FColorLine;
                    ForcePaint       = true;
                }
                if (Punto.ColorLine2 != FColorLine) {
                    Punto.ColorLine2 = FColorLine;
                    ForcePaint       = true;
                }
            }
            // Mette in evidenza il punto pià vicino
            var PuntoVicino = FGetNearestPoint(mouse.rx, mouse.ry);
            if (PuntoVicino != null) {
                var ColorEvidence = (FModalita == TRK_ERASE_POINT ? FColorErasing : FColorEvidence);
                switch (PuntoVicino.Punto) {
                    case 1:
                        FLsSegmenti[PuntoVicino.index].ColorLine1 = ColorEvidence;
                        break;
                    case 2:
                        FLsSegmenti[PuntoVicino.index].ColorLine2 = ColorEvidence;
                        break;
                }
                ForcePaint = true;
            }

        } else {
            FEndPoint  = null;
            ForcePaint = true;
        }

        if (ForcePaint) FPaintCanvas();

    }


    function FOnMouseLeave() {
        FEndPoint = null;
        FPaintCanvas();
    }

    function ExecuteLogin() {
        FConnessione.send('LOGIN~' + document.getElementById('logUserName').value + '~' + document.getElementById('logPassword').value);
    }

    function FOnKeyDown(e) {
        var event = window.event || e;
        if (FStato == STATO_EDITING)
            if (event.which == 27) {
                FStartPoint = null;
                FPaintCanvas();
            }
        if (FStato == STATO_LOGIN)
            if (event.which == 13)
                if (!document.getElementById('BtnLogin').disabled)
                    ExecuteLogin();

    }


    //*********************************************
    // MAIN
    //*********************************************

    if (FCanvas == null) {
        console.log("ERRORE: Canvas non trovata");
        FLockAll('CANVAS NON TROVATA');
    } else {
        if (FContext == null) {
            console.log("ERRORE: Contesto non creato");
            FLockAll('CANVAS NON TROVATA');
        }
    }

    FGraficoAncore.Background      = '#f1fffb';
    FGraficoAncore.Title           = 'Stato ancore';
    FGraficoAncore.BackgroundTitle = '#1b5549';

    FGraficoTag.Background      = '#c0e4ff';
    FGraficoTag.Title           = 'Stato WeTAG';
    FGraficoTag.BackgroundTitle = '#1b4a7e';

    FGraficoEmergency.Background      = "#fff8a6";
    FGraficoEmergency.Title           = 'Evacuazione';
    FGraficoEmergency.BackgroundTitle = "#FF0000";

    update(); // start it happening
    setupMouse(FCanvas);
    FAttendiConnessione();
    document.getElementById("NomeAncora").value = 0;
    document.getElementById("BtnLogin").addEventListener("click", ExecuteLogin);
    document.getElementById("BtnLogout").addEventListener("click", LogOut);
    document.getElementById("BtnEnableEditing").addEventListener("click", function () {
        FChangeStato(FStato == STATO_VISUALIZZAZIONE ? STATO_EDITING : STATO_VISUALIZZAZIONE);
        FAncoreDaRegistrare = [];
    });
    document.getElementById("BtnCloseMessage").addEventListener("click", function () {
        FChangeStato(FPreviousStato);
    });
    document.getElementById('logUserName').addEventListener('input', FOnChangeLogin);
    document.getElementById(NomeCanvas).addEventListener('mousemove', FOnMouseMoveCanvas);
    document.getElementById(NomeCanvas).addEventListener('click', FOnClickCanvas);
    document.getElementById('CkOrizzontale').addEventListener('click', FOnClickStyleDrawing);
    document.getElementById('CkVerticale').addEventListener('click', FOnClickStyleDrawing);
    document.getElementById('AggiungiAncora').addEventListener('click', FOnClickStyleDrawing);
    document.getElementById('CkNormale').addEventListener('click', FOnClickStyleDrawing);
    document.getElementById('CkErasePoint').addEventListener('click', FOnClickStyleDrawing);
    document.getElementById('BtnRefreshStorico').addEventListener('click', FOnRefreshStorico);
    document.getElementById('BtnCambiaPassword').addEventListener('click', function () {
        FChangeStato(STATO_CAMBIO_PASSWORD);
    });
    document.getElementById('grpGraficoAncore').addEventListener('click', function () {
        ShowMessage(FGetListaAncore);
    });
    document.getElementById('grpGraficoTag').addEventListener('click', function () {
        ShowMessage(FGetListaTag);
    });

    document.getElementById('BtnAllarmiAttivi').addEventListener('click', function () {
        ShowMessage(function () {
            var ElencoAllarmi = "";
            for (var i in FLsFari) {
                if ((FLsFari[i] != undefined) && (FLsFari[i].Nome != undefined))
                    if (SomeFaroAlarmActive(FLsFari[i])) {
                        ElencoAllarmi += "<div style=\"clear:both;padding-top:3px;font-weight:bold;height:20px;background:#FCBF2F;color:white;text-align:center\">" + FLsFari[i].Nome + "</div>" +
                            "<div style=\"clear:both;height:4px\">&nbsp</div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left;padding-top:8px\">Allarmi</div><div>" +
                            GetFaroIconAlarm(FLsFari[i]) + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">WeTAG</div><div>" + i + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Piano</div><div>" + FLsFari[i].Piano + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">MAC</div><div>" + FLsFari[i].Mac + "</div></div>" +
                            "<div style=\"clear:both\"><div style=\"font-weight:bold;width:30%;float:left\">Ancora rif.</div><div>" + FLsFari[i].AncoraRif + "</div></div>" +
                            "<div style=\"clear:both;height:8px\">&nbsp</div>";
                    }
            }
            return (ElencoAllarmi);
        });
    });

    document.getElementById('BtnShowMsgChiudi').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
    });
    document.getElementById('BtnAnnullaPassword').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
    });
    document.getElementById('BtnConfermaPassword').addEventListener('click', function () {
        FConnessione.send('CHGPASSWORD~' + document.getElementById('pwdOldPassword').value + '~' + document.getElementById('pwdNuovaPassword').value);
    });
    document.getElementById('pwdOldPassword').addEventListener('input', FEnableConfermaCambiaPassword);
    document.getElementById('pwdNuovaPassword').addEventListener('input', FEnableConfermaCambiaPassword);
    document.getElementById('pwdCheckPassword').addEventListener('input', FEnableConfermaCambiaPassword);
    document.getElementById('dimLarghezza').addEventListener('input', FEnableConfermaDimensioni);
    document.getElementById('nomeTag').addEventListener('input', FEnableConfermaNomeTag);
    document.getElementById('NamePiani').addEventListener('input', FEnableConfermaDimensioni);
    document.getElementById('dimTacca').addEventListener('input', FEnableConfermaDimensioni);
    document.getElementById('immagine').addEventListener('change', encodeImageFileAsURL);
    document.getElementById('BtnEvacuazione').setAttribute('AlarmOn', '0');
    document.getElementById('BtnEvacuazione').src = 'Evacuazione.png';
    document.getElementById('BtnEvacuazione').addEventListener('click', function () {
        FConnessione.send('ADVICE_TO_TAG~' +
            (document.getElementById('BtnEvacuazione').getAttribute('AlarmOn') == '0' ? ALARM_TAG_EVACUAZIONE : ALARM_TAG_STOP_EVAC) + '~' +
            ID_TAG_BROADCAST);
    });
    document.getElementById('BtnStorico').addEventListener("click", function () {
        FChangeStato(STATO_STORICO);
        RefreshDivStorico();
    });
    document.getElementById('BtnConfermaStorico').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE)
    });
    document.getElementById("BtnConfermaModifiche").addEventListener("click", function () {
        FModalita   = TRK_LINE_HORIZONTAL;
        FStartPoint = null;
        FOnSavePoints();
        document.getElementById("DescrizioneIdAncora").style.display = "none";
        document.getElementById("NomeAncora").style.display          = "none";
        document.getElementById("NomeAncora").value                  = 0
        for (var Ancora of FAncoreDaRegistrare)
            FConnessione.send('SETANCHORS~' + Ancora);
    });
    document.getElementById("BtnAnnullaModifiche").addEventListener("click", function () {
        FModalita   = TRK_LINE_HORIZONTAL;
        FStartPoint = null;
        FConnessione.send('GETPOINTS~' + FPianoAttuale);
        document.getElementById("DescrizioneIdAncora").style.display = "none";
        document.getElementById("NomeAncora").style.display          = "hidden";
    });
    document.getElementById("BtnPosizioneAncore").addEventListener("click", function () {
        FChangeStato(STATO_MODIFICA_ANCORE);
    });
    document.getElementById('BtnAnnullaAncore').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
        FPaintCanvas();
    });
    document.getElementById('BtnSelezionaPiano').addEventListener('click', function () {
        FChangeStato(STATO_SELEZIONA_PIANO);
        FPaintCanvas();
    });
    document.getElementById('BtnConfermaAncore').addEventListener('click', FSetAncore);
    document.getElementById("BtnDimensioniMappa").addEventListener("click", function () {
        FChangeStato(STATO_CAMBIO_DIM);
    });
    document.getElementById('BtnAnnullaDimMappa').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
    });
    document.getElementById('BtnConfermaDimMappa').addEventListener('click', function () {
        FLarghezza = document.getElementById('dimLarghezza').value / 100;
        FTacca     = document.getElementById('dimTacca').value / 100;
        FNomePiano = document.getElementById('NamePiani').value;
        FOnSavePoints();
        FChangePiano();
    });
    document.getElementById('BtnAnnullaPianoSelezionato').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
        FPaintCanvas();
    });
    document.getElementById('BtnConfermaPianoSelezionato').addEventListener('click', FOnClickBtnConfermaPianoSelezionato);
    document.getElementById('BtnDoveSiTrova').addEventListener('click', function () {
        FChangeStato(STATO_TROVA_BEACON);
        FPaintCanvas();
    });
    document.getElementById('BtnAnagraficaTag').addEventListener('click', function () {
        FChangeStato(STATO_MODIFICA_TAG);
        FPaintCanvas();
    });
    document.getElementById('BtnAnnullaFaroDaTrovare').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
        FPaintCanvas();
    });
    document.getElementById('BtnConfermaFaroDaTrovare').addEventListener('click', FOnClickConfermaFaroDaTrovare);
    document.getElementById("BtnConfermaAnagraficaTag").addEventListener("click", function () {
        FIdTag   = document.getElementById("FaroSelezionato2").value;
        FNomeTag = document.getElementById("nomeTag").value;
        FSetNomeTag()
    });
    document.getElementById('BtnAnnullaAnagraficaTag').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
        FPaintCanvas();
    });
    document.getElementById('NumeroAncore').addEventListener('input', function () {
        FSalvaCopiaPaginaAncore();
        FDisponiPaginaAncore()
    });
    document.getElementById('BtnPagAncorePrecedenti').addEventListener('click', function () {
        FSalvaCopiaPaginaAncore();
        FPaginaAncore--;
        FDisponiPaginaAncore();
    });
    document.getElementById('BtnPagAncoreSuccessive').addEventListener('click', function () {
        FSalvaCopiaPaginaAncore();
        FPaginaAncore++;
        FDisponiPaginaAncore();
    });
    //document.getElementById("BtnPosizioneZone").addEventListener("click", function () { FChangeStato(STATO_MODIFICA_ZONE);});
    document.getElementById('BtnAnnullaZone').addEventListener('click', function () {
        FChangeStato(STATO_VISUALIZZAZIONE);
    });
    document.getElementById('NumeroZone').addEventListener('input', function () {
        FSalvaCopiaPaginaZone();
        FDisponiPaginaZone();
    });
    document.getElementById('BtnPagZonePrecedenti').addEventListener('click', function () {
        FSalvaCopiaPaginaZone();
        FPaginaZone--;
        FDisponiPaginaZone();
    });
    document.getElementById('BtnPagZoneSuccessive').addEventListener('click', function () {
        FSalvaCopiaPaginaZone();
        FPaginaZone++;
        FDisponiPaginaZone();
    });
    document.getElementById('BtnConfermaZone').addEventListener('click', FSetZone);
    document.addEventListener('keydown', FOnKeyDown);
    ShowAllButtons();


    FImageAncora             = document.createElement('img');
    FImageAncora.src         = 'LogoAncora.png';
    FImageAncoraSbiadita     = document.createElement('img');
    FImageAncoraSbiadita.src = 'LogoAncoraSbiadita.png';
    FImageVideocamera        = document.createElement('img');
    FImageVideocamera.src    = 'LogoVideocamera.png';


    var FConnessione = new WebSocket(WebSocketCoordinates);


    FConnessione.onopen = function (e) {
        console.log("Connection established!");
        FChangeStato(STATO_LOGIN);
    };

    function FHandleServerError(CodeError, Error) {
        switch (CodeError) {
            case '1':
                FShowError('SQL ERROR [' + Error + ']', false);
                break;
            case '2':
                FShowError('Account sconosciuto', true);
                break;
            case '3':
                FShowError('Password errata', true);
                break;
            case '4':
                FShowError('Utente non loggato', false);
                break;
            case '5':
                FShowError('System error [' + Error + ']', false);
                break;
            default :
                FShowError('Errore sconosciuto', false);
                break;
        }
    }

    FConnessione.onmessage = function (e) {
        //console.log(e.data);
        var Messaggio = e.data;
        var Parametri = Messaggio.split('~');
        switch (Parametri[0]) {
            case 'LOGIN':
                if (Parametri[1] == '0') {
                    FLarghezza = null;
                    FTacca     = null;

                    FSuperUser = Parametri[2] != "0";
                    ShowAllButtons();
                    FChangeStato(STATO_VISUALIZZAZIONE);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'CHGPASSWORD':
                if (Parametri[1] == '0') {
                    FChangeStato(STATO_VISUALIZZAZIONE);
                    FShowError('Password modificata', true);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'SETPOINTS':
                if (Parametri[1] == '0') {
                    FChangeStato(STATO_VISUALIZZAZIONE);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'SETDIMMAP':
                if (Parametri[1] == '0') {
                    FShowError('Dimensioni mappa cambiate', true);
                    try {
                        FLarghezza = document.getElementById('dimLarghezza').value / 100;
                    } catch (E) {
                        FLarghezza = 10;
                    }
                    if (FLarghezza == 0) FLarghezza = 10;
                    try {
                        FTacca = document.getElementById('dimTacca').value / 100;
                    } catch (E) {
                        FTacca = 1;
                    }
                    FNomePiano = document.getElementById("NamePiani").value;
                    //FImgMappa=document.getElementById('imm').value;
                    if (FTacca == 0) FTacca = 1;


                    FChangeStato(STATO_VISUALIZZAZIONE);
                    FPaintCanvas();
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETPOINTS':
                if (Parametri[1] == '0') {
                    FTranslatePunti(Parametri[2], Parametri[3], Parametri[4], Parametri[5], Parametri[6]);
                    FChangeStato(STATO_VISUALIZZAZIONE);
                    FPaintCanvas();
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETHISTORY':
                if (Parametri[1] == '0') {
                    FLoadHistory(Parametri[2], Parametri[3], Parametri[4], Parametri[5]);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETANCHORS':
                if (Parametri[1] == '0') {
                    FLoadAncore(Parametri[2]);
                    FPaintCanvas();
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETVIDEO':
                if (Parametri[1] == '0') {
                    FLoadVideocamere(Parametri[2]);
                    FPaintCanvas();
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETZONES':
                if (Parametri[1] == '0') {
                    FLoadZones(Parametri[2]);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETEVENTLIST':
                if (Parametri[1] == '0') {
                    FLoadEventList(Parametri[2]);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'GETFLOORS': {
                if (Parametri[1] == '0') {
                    FLoadFloors(Parametri[2]);
                } else FHandleServerError(Parametri[1], Parametri[2]);
            }
                break;
            case 'GETBEACONS':
                if (FStato == STATO_VISUALIZZAZIONE) {
                    if (Parametri[1] == '0') {
                        FLoadFari(Parametri[2], Parametri[3]);
                        FPaintCanvas();
                    } else FHandleServerError(Parametri[1], Parametri[2]);
                }
                break;
            case 'SETANCHORS':
                if (Parametri[1] == '0') {
                    FConnessione.send('GETANCHORS');
                    if (FStato == STATO_MODIFICA_ANCORE) {
                        FShowError('Ancore registrate', true);
                        FChangeStato(STATO_VISUALIZZAZIONE);
                    }

                    FPaintCanvas();
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'SETBEACONS':
                if (Parametri[1] == '0') {
                    FShowError('Tag registrati', true);
                    FNomeTag = document.getElementById("nomeTag").value;
                    FIdTag   = document.getElementById("FaroSelezionato2").value;
                    FChangeStato(STATO_VISUALIZZAZIONE);
                    FPaintCanvas();
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'SETZONES':
                if (Parametri[1] == '0') {
                    FConnessione.send('GETZONES');
                    FShowError('Zone registrate', true);
                    FChangeStato(STATO_VISUALIZZAZIONE);
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            case 'LOGOUT':
                FPianoAttuale = null;
                FSuperUser    = false;
                ShowAllButtons();
                FChangeStato(STATO_LOGIN);
                break;
            case 'ADVICE_TO_TAG':
                if (Parametri[1] == '0') {
                    if (Parametri[3] == 'FFFFFFFFFFFF') {
                        if (document.getElementById('BtnEvacuazione').getAttribute('AlarmOn') == '0') {
                            document.getElementById('BtnEvacuazione').setAttribute('AlarmOn', '1');
                            document.getElementById('BtnEvacuazione').src                = 'StopAlarm.png';
                            document.getElementById('grpGraficoAncore').style.display    = 'none';
                            document.getElementById('grpGraficoEmergency').style.display = 'inline-block';
                        } else {
                            document.getElementById('BtnEvacuazione').setAttribute('AlarmOn', '0');
                            document.getElementById('BtnEvacuazione').src                = 'Evacuazione.png';
                            document.getElementById('grpGraficoAncore').style.display    = 'inline-block';
                            document.getElementById('grpGraficoEmergency').style.display = 'none';
                        }
                    }
                } else FHandleServerError(Parametri[1], Parametri[2]);
                break;
            default:
                FShowError(e.data, false);
                break;
        }
        Parametri = null;
    };

    FConnessione.onclose = function (ev) {
        console.log('Connection closed.');
        FShowError('Connessione chiusa', false);
    }

    FConnessione.onerror = function (ev) {
        console.log('errore');
        FShowError(ev.data, false);
    };
}


