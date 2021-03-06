/*
  jQuery api.googlechart - 0.2
  http://code.google.com/p/jquery-utils/

  (c) Maxime Haineault <haineault@gmail.com> 
  http://haineault.com

  MIT License (http://www.opensource.org/licenses/mit-license.php

  Dependencies
  ------------
  - jquery.utils.js
  - jquery.strings.js
  - jquery.builder.js
  - jquery.ui.js
  
*/

(function($){
    // experimental
    $.component = function() {
        if (!this.components) { this.components = []; }
        if (arguments.length == 1 && $.isObject(arguments[0])) {
            var ns = arguments[0].name + '.component';
            this.components[ns] = arguments[0];
            $.tpl(ns, arguments[0].tpl);
        }
        else {
            var ns  = arguments[0] + '.component';
            var opt = $.extend(this.components[ns], arguments[1] || {});
            var tpl = $.tpl(ns, opt);
            if (opt.events) {
                for (k in opt.events) {
                    var e = opt.events[k];
                    e.selector && tpl.find(e.selector).bind(e.type +'.component', e.callback) 
                               || tpl.bind(e.type +'.component', e.callback);
                }
            }
            if (opt.init) { opt.init.apply(tpl); }
            return tpl;
        }
    };

    $.component({
        name: 'countrylist',
        tpl:  '<div class="api-gc-countries ui-reset ui-clearfix" />',
        init: function() {
            var o = ['<select class="api-gc-country-list ui-helper-hidden" multiple="true">'];
            for (cc in $.ui.googleChart.countries) {
                o.push($.format('<option value="{0:s}">{1:s}</option>', cc, $.ui.googleChart.countries[cc]));
            }
            o.push('</select><select class="api-gc-usa-state-list ui-helper-hidden" multiple="true">');
            for (cs in $.ui.googleChart.usStates) {
                o.push($.format('<option value="{0:s}">{1:s}</option>', cs, $.ui.googleChart.usStates[cs]));
            }
            o.push('</select>');
            $(this).append(o.join(''));
        }
    });

    $.component({
        name: 'arealist',
        tpl:  '<ul class="api-gc-area-list ui-reset" />',
        init: function() {
            var o = [];
            var tpl = '<li class="ui-reset"><a href="#{0:s}" class="ui-state-default"><span class="ui-icon ui-icon-triangle-1-e"></span>{1:s}</a></li>';
            for (k in $.ui.googleChart.areas) {
                $(this).append($.format(tpl, k, $.ui.googleChart.areas[k]));
            }
            $(this).append('<li class="label ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-bottom">Area</li></ul>')
                   .height(chart._height());
        },
        events: [
            {type: 'refreshMap', callback: function() { 
                var chtm = $('li.selected a', this).attr('href').replace('#','');
                var lbl  = $('li.selected a', this).text();
                chart.options.chtm = chtm;
                chart._ui.label.fadeOut(1000, function(){
                    $(this).text(lbl).fadeIn(); 
                });
                chart._refresh();
            }}
        ]
    });

    $.component({
        name: 'selectsize',
        tpl:  '<span class="ui-component"><label>{label:s}:</label><select></select></span>',
        init: function() {
            $(this).find('select').append($.map(chart.options.sizes, function(v){
                return $.ui.builder.option({value: v, label: v}, true);
            }).join('')).val(chart.options.chs);
        },
        events: [
            {type: 'change', callback: function(){
                chart.options.chs = $(this).find('select').val();
                chart._refresh(chart.options); 
            }}
        ]
    });

    $.component({
        name: 'colorpicker',
        tpl:  '<span class="ui-component api-gc-colorpicker"><label>{label:s}:</label><span class="preview">&nbsp;</span><input type="text" maxlength="7" /></span>',
        events: [
            {type: 'updatePreview', callback: function() { $(this).find('span').css('background-color', $('input', this).val()); }},
            //{type: 'refreshMap',    callback: function() { $(this).trigger('updatePreview.component'); }},
            {type: 'blur',  selector: 'input', callback: function(e){ $(this).parent().trigger('refreshMap.component'); }},
            {type: 'keyup', selector: 'input', callback: function(e){ 
                $(this).parent().trigger($.keyIs('enter', e) && 'refreshMap.component' || 'updatePreview.component');
            }}
        ]
    });

    $.tpl('googlechart.panelGeneral',  '<ul class="ui-form ui-helper-reset ui-helper-clearfix" style="float:left;" /><ul class="ui-form ui-helper-reset" style="margin-left:120px;padding-left:20px;" /><div style="clear:both;" />');
    $.tpl('googlechart.panelGradient', '<ul class="ui-form ui-helper-reset" style="float:left;" /><div style="clear:both;" />');

    $.widget('ui.googleChart', {
        _init: function(){
            this._ui.wrapper.append(this._ui.rightpanel)
                            .append(this._ui.viewport)
                            .append(this._ui.toolbar.append(this._ui.label))
                            .appendTo(this.element);

            this._plugin_call('_init');
            $.ui.googleChart.charts[this.options.cht].call(this);
            this._plugin_call('_initialized');
            $('.ui-button').hover(function(){  $(this).addClass('ui-state-hover'); }, 
                                  function (){ $(this).removeClass('ui-state-hover'); });
        },

        _width:  function() { var s = this.options.chs.split('x'); return parseInt(s[0], 10); },
        _height: function() { var s = this.options.chs.split('x'); return parseInt(s[1], 10); },

        _ui: {
            wrapper:    $('<div class="api-gc-wrapper" />'),
            viewport:   $('<div class="api-gc-viewport" />'),
            rightpanel: $('<div class="api-gc-panel" />'),
            toolbar:    $.ui.builder.toolbar().addClass('api-gc-toolbar'),
            label:      $('<span class="api-gc-chart-label" />'),
            link:       $('<div class="api-gc-chart-link ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all ui-helper-hidden"><input type="text" value="" class=" ui-corner-all" /></div>'),
            options:    $('<div class="api-gc-chart-options ui-helper-reset ui-widget-content ui-corner-all ui-helper-hidden" />')
        },

        _refresh: function(opt) {
            var url = this._get_url(opt || this.options, this.params);
            this._ui.link.find('input[type=text]').val(url);
            this._ui.toolbar.width(this._width());
            this._ui.options.width(this._width() - 10);
            this._ui.rightpanel.css('margin-left', this._width() + 10);
            this._ui.viewport
                .width(this._width()).height(this._height())
                .css({backgroundImage: $.format('url({0:s})', url),
                      backgroundRepeat: 'no-repeat'});
            return this;
        },

        _size: function(size) {
            if (!size) { return chart.options.chs; }
            chart.options.chs = size;
            return this;
        },

        _set_bg_color: function(color) {
            if (color) { chart.options.chf = 'bg,s,'+ color.replace('#',''); }
            return this;
        },

        _set_fg_color: function(color, idx) {
            var chco  = chart.options.chco.split(',');
            chco[idx||0] = color.replace('#','');
            chart.options.chco = chco.join(',');
            return this;
        },

        _set_label: function(label){
            this._ui.label.text(label);
            return this;
        },

        _plugin_call: function(method, args) {
            for (k in $.ui.googleChart.plugins) {
                var plugin = $.ui.googleChart.plugins[k];
                if (plugin[method]) {
                    plugin[method].apply(this, args || []);
                }
            }
            return this;
        },

        _get_url: function(options, params) {
            var o = [];
            for (k in params) {
                if (options[params[k]]) { o.push(params[k] +'='+ options[params[k]]); }
            }
            return options.url +'?'+ o.join('&');
        }
    });

    $.extend($.ui.googleChart, {
        charts: {},
        plugins: {},
        defaults: {
            url: 'http://chart.apis.google.com/chart',
            cht: 't',
            chs: '440x220',
            link: true,
            options: true
        },
        areas: {'africa':"Africa", 'asia':"Asia", 'europe':"Europe", 'middle_east':"Middle Eeast", 'south_america':"South America", 'usa':"USA", 'world':"World"},
        areasCountries: { 'usa': 'AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY'.split(','),
'africa': 'AF,DZ,AO,AR,BD,BJ,BO,BW,BR,BF,BI,CM,CF,TD,CN,CG,CD,CI,DJ,EG,ER,ET,GA,GH,GR,GN,GW,GY,IN,ID,IR,IQ,IL,IT,JO,KE,LA,LB,LR,LY,MG,MW,MY,ML,MR,MA,MZ,MM,NA,NE,NG,OM,PK,PY,PT,RW,SA,SN,SL,SO,ZA,ES,LK,SD,SR,SY,TJ,TZ,TH,TG,TN,TR,TM,UG,AE,UY,UZ,VE,EH,YE,ZM,ZW'.split(','), 'asia': 'AF,AM,AU,AZ,BD,BY,BT,BG,BF,BI,KH,CN,EG,ER,ET,GE,IN,ID,IR,IQ,JP,JO,KZ,KE,KP,KR,KW,KG,LA,MW,MY,MD,MN,MZ,MM,NP,OM,PK,PG,PH,RO,RU,RW,SA,SO,LK,SD,SY,TW,TJ,TZ,TH,TR,TM,UG,UA,AE,UZ,VN,YE,ZM'.split(','), 'europe': 'AL,AM,AT,AZ,BY,BE,BA,HR,CZ,DK,EE,FI,FR,GE,DE,GR,GL,GD,HU,IR,IQ,IE,IT,KZ,LV,LB,LT,LU,MK,MD,MA,NL,NO,PL,PT,RO,RU,SK,SI,SB,ES,SE,CH,SY,TN,TR,TM,UA,GB,UZ'.split(','), 'middle_east': 'AF,AL,DZ,AM,BJ,BA,BG,BF,CM,TD,CN,HR,DJ,EG,ER,ET,FR,GE,GR,HU,IN,IR,IQ,IL,IT,JO,KZ,KW,KG,LB,LY,MK,ML,NP,NE,NG,OM,PK,QA,RO,RU,SA,SN,SO,ES,SD,CH,SY,TJ,TO,TN,TR,TM,UAAE,UZ,YE'.split(','), 'south_america': 'AO,AR,BJ,BO,BW,BV,BR,BF,CM,CF,TD,CL,CO,CG,CD,CR,CI,EC,GQ,FK,GF,GA,GH,GN,GW,GY,LR,ML,NA,NI,NE,NG,PA,PY,PE,SN,SL,ZA,SR,TG,UY,VE'.split(',') },
        countries: { 
            'AF':"Afghanistan",'AX':"Aland islands",'AL':"Albania",'DZ':"Algeria",'AS':"American samoa",'AD':"Andorra",'AO':"Angola",'AI':"Anguilla",'AQ':"Antarctica",'AG':"Antigua and Barbuda",
            'AR':"Argentina",'AM':"Armenia",'AW':"Aruba",'AU':"Australia",'AT':"Austria",'AZ':"Azerbaijan",'BS':"Bahamas",'BH':"Bahrain",'BD':"Bangladesh",'BB':"Barbados",'BY':"Belarus",
            'BE':"Belgium",'BZ':"Belize",'BJ':"Benin",'BM':"Bermuda",'BT':"Bhutan",'BO':"Bolivia",'BA':"Bosnia and Herzegovina",'BW':"Botswana",'BV':"Bouvet Island",'BR':"Brazil",
            'IO':"British Indian Ocean Territory",'BN':"Brunei Darussalam",'BG':"Bulgaria",'BF':"Burkina Faso",'BI':"Burundi",'KH':"Cambodia",'CM':"Cameroon",'CA':"Canada",'CV':"Cape verde",
            'KY':"Cayman Islands",'CF':"Central African Republic",'TD':"Chad",'CL':"Chile",'CN':"China",'CX':"Christmas Island",'CC':"Cocos (Keeling) Islands",'CO':"Colombia",'KM':"Comoros",
            'CG':"Congo",'CD':"Congoe",'CK':"Cook Islands",'CR':"Costa Rica",'CI':"Côte D'ivoire",'HR':"Croatia",'CU':"Cuba",'CY':"Cyprus",'CZ':"Czech Republic",
            'DK':"Denmark",'DJ':"Djibouti",'DM':"Dominica",'DO':"Dominican Republic",'EC':"Ecuador",'EG':"Egypt",'SV':"El Salvador",'GQ':"Equatorial Guinea",'ER':"Eritrea",'EE':"Estonia",
            'ET':"Ethiopia",'FK':"Falkland Islands (Malvinas)",'FO':"Faroe Islands",'FJ':"Fiji",'FI':"Finland",'FR':"France",'GF':"French Guiana",'PF':"French Polynesia",
            'TF':"French Southern Territories",'GA':"Gabon",'GM':"Gambia",'GE':"Georgia",'DE':"Germany",'GH':"Ghana",'GI':"Gibraltar",'GR':"Greece",'GL':"Greenland",'GD':"Grenada",
            'GP':"Guadeloupe",'GU':"Guam",'GT':"Guatemala",'GG':"Guernsey",'GN':"Guinea",'GW':"Guinea-BisKyrgyzstansau",'GY':"Guyana",'HT':"Haiti",'HM':"Heard Island and McDonald Islands",
            'VA':"Holy See (Vatican City State)",'HN':"Honduras",'HK':"Hong Kong",'HU':"Hungary",'IS':"Iceland",'IN':"India",'ID':"Indonesia",'IR':"Iran",'IQ':"Iraq",'IE':"Ireland",
            'IM':"Isle of Man",'IL':"Israel",'IT':"Italy",'JM':"Jamaica",'JP':"Japan",'JE':"Jersey",'JO':"Jordan",'KZ':"KazakhstanKyrgyzstan",'KE':"Kenya",'KI':"Kiribati",
            'KP':"North Korea",'KR':"South Korea",'KW':"Kuwait",'KG':"Kyrgyzstan",'LA':"Lao",'LV':"Latvia",'LB':"Lebanon",'LS':"Lesotho",
            'LR':"Liberia",'LY':"Libyan Arab Jamahiriya",'LI':"Liechtenstein",'LT':"Lithuania",'LU':"Luxembourg",'MO':"Macao",'MK':"Macedonia",'MG':"Madagascar",
            'MW':"Malawi",'MY':"Malaysia",'MV':"Maldives",'ML':"Mali",'MT':"Malta",'MH':"Marshall Islands",'MQ':"Martinique",'MR':"Mauritania",'MU':"Mauritius",'YT':"Mayotte",'MX':"Mexico",
            'FM':"Micronesia,Federated state of",'MD':"Moldova",'MC':"Monaco",'MN':"Mongolia",'ME':"Montenegro",'MS':"Montserrat",'MA':"Morocco",'MZ':"Mozambique",'MM':"Myanmar",
            'NA':"Namibia",'NR':"Nauru",'NP':"Nepal",'NL':"Netherlands",'AN':"Netherlands Antilles",'NC':"New Caledonia",'NZ':"New Zealand",'NI':"Nicaragua",'NE':"Niger",'NG':"Nigeria",'NU':"Niue",
            'NF':"Norfolk Island",'MP':"Northern Mariana Islands",'NO':"Norway",'OM':"Oman",'PK':"Pakistan",'PW':"Palau",'PS':"Palestinian Territory,occupied",'PA': "Panama",'PG':"Papua New Guinea",
            'PY':"Paraguay",'PE':"Peru",'PH':"Philippines",'PN':"Pitcairn",'PL':"Poland",'PT':"Portugal",'PR':"Puerto Rico",'QA':"Qatar",'RE':"Réunion",'RO':"Romania",'RU':"Russian Federation",
            'RW':"Rwanda",'BL':"Saint Barthélemy",'SH':"Saint Helena",'KN':"Saint Kitts and Nevis",'LC':"Saint Lucia",'MF':"Saint Martin",'PM':"Saint Pierre and Miquelon",
            'VC':"Saint Vincent and The Grenadines",'WS':"Samoa",'SM':"San Marino",'ST':"Sao Tome and Principe",'SA':"Saudi Arabia",'SN':"Senegal",'RS':"Serbia",'SC':"Seychelles",'SL':"Sierra Leone",
            'SG':"Singapore",'SK':"Slovakia",'SI':"Slovenia",'SB':"Solomon Islands",'SO':"Somalia",'ZA':"South Africa",'GS':"South Georgia and The South Sandwich Islands",'ES':"Spain",'LK':"Sri Lanka",
            'SD':"Sudan",'SR':"Suriname",'SJ':"Svalbard and Jan Mayen",'SZ':"Swaziland",'SE':"Sweden",'CH':"Switzerland",'SY':"Syrian Arab Republic",'TW':"Taiwan,Province of China",'TJ':"Tajikistan",
            'TZ':"Tanzania",'TH':"Thailand",'TL':"Timor-Leste",'TG':"Togo",'TK':"Tokelau",'TO':"Tonga",'TT':"Trinidad and Tobago",'TN':"Tunisia",'TR':"Turkey",'TM':"Turkmenistan",
            'TC':"Turks and Caicos Islands",'TV':"Tuvalu",'UG':"Uganda",'UA':"Ukraine",'AE':"United Arab Emirates",'GB':"United Kingdom",'US':"United state",'UM':"United state Minor Outlying Islands",
            'UY':"Uruguay",'UZ':"Uzbekistan",'VU':"Vanuatu",'VE':"Venezuela",'VN':"Viet nam",'VG':"Virgin Islands,British",'VI':"Virgin Islands,U.S.",'WF':"Wallis and Futuna",'EH':"Western Sahara",
            'YE':"Yemen",'ZM':"Zambia",'ZW':"Zimbabwe"
        },
        usStates: {'AL':"Alabama",'AK':"Alaska",'AZ':"Arizona",'AR':"Arkansas",'CA':"California",'CO':"Colorado",'CT':"Connecticut",'DE':"Delaware",'FL':"Florida",'GA':"Georgia",'HI':"Hawaii",
            'ID':"Idaho",'IL':"Illinois",'IN':"Indiana",'IA':"Iowa",'KS':"Kansas",'KY':"Kentucky",'LA':"Louisiana",'ME':"Maine",'MD':"Maryland",'MA':"Massachusetts",'MI':"Michigan",'MN':"Minnesota",
            'MS':"Mississippi", 'MO':"Missouri",'MT':"Montana",'NE':"Nebraska",'NV':"Nevada",'NH':"New Hampshire",'NJ':"New Jersey",'NM':"New Mexico",'NY':"New York",'NC':"North Carolina",
            'ND':"North Dakota",'OH':"Ohio",'OK':"Oklahoma",'OR':"Oregon",'PA':"Pennsylvania",'RI':"Rhode Island",'SC':"South Carolina",'SD':"South Dakota",'TN':"Tennessee",'TX':"Texas",'UT':"Utah",
            'VT':"Vermont",'VA':"Virginia",'WA':"Washington",'WV':"West Virginia",'WI':"Wisconsin",'WY':"Wyoming"}
    });
    
    $.extend($.ui.googleChart.charts, {
        // map
        t: function() {
            chart = this;
            chart.params  = ['chs', 'cht', 'chd', 'chtm', 'chld', 'chco', 'chf'];
            chart.options = $.extend({
                cht:       't',     // chart type (map)
                chd:       's:_',   // chart data
                chtm:      'world', // area
                chld:      '',      // country(ies)
                chco:      'eeeeee,DFB5B5,DFDBB5,B7DFB5', // colors
                chf:       'bg,s,cccccc', // background (water masses)
                areas:     true, // show areas
                countries: true, // show contries (areas must be true)
                sizes:     ['440x220', '400x200', '380x190', '360x180', '340x170', '320x160']
            }, chart.options);

            if (chart.options.areas) {
                chart._ui.arealist = $.component('arealist')
                    .appendTo(chart._ui.rightpanel)
                    .find('li a')
                        .click(function(e){
                            var area = $(this).attr('href').replace('#','');
                            $(this).parent().addClass('selected').siblings().removeClass('selected');
                            chart._ui.arealist.trigger('refreshMap.component');
                            if (area != 'usa') {
                                chart._ui.contrylist.find('select')
                                    .filter('.api-gc-usa-state-list:visible').hide('slide', {direction: 'left'}).end()
                                    .filter('.api-gc-country-list:hidden')
                                        
                                        .show('slide', {direction: 'left'}).end();
                            }
                            else {
                                chart._ui.contrylist.find('select')
                                    .filter('.api-gc-country-list:visible').hide('slide', {direction: 'left'}).end()
                                    .filter('.api-gc-usa-state-list:hidden').show('slide', {direction: 'left'}).end();
                            }
                        }).end();

                if (chart.options.countries) {
                    chart._ui.contrylist = $.component('countrylist')
                        .height(chart._height())
                        .appendTo(chart._ui.rightpanel)
                        .find('option')
                            .mouseup(function(e){
                                var chld = $(this).parent().val();
                                chart.options.chld = chld.join('');
                                chart.options.chd  = $.format('t:{0:s}', $.map($.range(0, 100, 100 / chld.length), $.iterators.parseInt).join(',')),
                                chart._refresh();
                            }).end();
                }
            }

            // Option panel
            if (this.options.options) {
                // General options tab
                this._ui.panelGeneral = $.ui.builder.tab(this._ui.options, {title: 'General'})
                                            .append($.tpl('googlechart.panelGeneral'));

                $.component('colorpicker', { label: 'Foreground'})
                    .appendTo($('<li />')).parent()
                    .appendTo(this._ui.panelGeneral.find('ul:eq(0)'))
                    .find('input').val('#'+ chart.options.chco.split(',')[0]).end()
                    .trigger('updatePreview.component')
                    .bind('refreshMap.component', function(){
                        chart._set_fg_color($('input', this).val())._refresh(); });

                $.component('colorpicker', { label: 'Background'})
                    .appendTo($('<li />')).parent()
                    .appendTo(this._ui.panelGeneral.find('ul:eq(0)'))
                    .find('input').val('#'+ chart.options.chf.slice(-6)).end()
                    .trigger('updatePreview.component')
                    .bind('refreshMap.component', function(){
                        chart._set_bg_color($('input', this).val())._refresh(); });

                $.component('selectsize', { label: 'Sizes'}).appendTo($('<li />')).parent()
                    .appendTo(this._ui.panelGeneral.find('ul:eq(1)'));

                // Gradient options tab
                this._ui.panelGradient = $.ui.builder.tab(this._ui.options, {title: 'Gradient'})
                                            .append($.tpl('googlechart.panelGradient'));

                $.component('colorpicker', { label: 'Start'})
                    .appendTo($('<li />')).parent()
                    .appendTo(this._ui.panelGradient.find('ul:eq(0)'))
                    .find('input').val('#'+chart.options.chco.split(',')[1]).end()
                    .trigger('updatePreview.component')
                    .bind('refreshMap.component', function(){
                        chart._set_fg_color($('input', this).val(), 1)._refresh(); });
                
                $.component('colorpicker', { label: 'Mid'})
                    .appendTo($('<li />')).parent()
                    .appendTo(this._ui.panelGradient.find('ul:eq(0)'))
                    .find('input').val('#'+chart.options.chco.split(',')[2]).end()
                    .trigger('updatePreview.component')
                    .bind('refreshMap.component', function(){
                        chart._set_fg_color($('input', this).val(), 2)._refresh(); });
                
                $.component('colorpicker', { label: 'End'})
                    .appendTo($('<li />')).parent()
                    .appendTo(this._ui.panelGradient.find('ul:eq(0)'))
                    .find('input').val('#'+chart.options.chco.split(',')[3]).end()
                    .trigger('updatePreview.component')
                    .bind('refreshMap.component', function(){
                        chart._set_fg_color($('input', this).val(), 3)._refresh(); });
            }
            chart._set_label(this.options.chtm);
            this._refresh(); // initial load
        }
    });

    $.extend($.ui.googleChart.charts, {
        lc: function() {
            chart = this;
            this.params  = ['chs', 'cht', 'chd', 'chtm', 'chld', 'chco', 'chf'];
            this.options = $.extend({
                cht:       'lc',
                chd:       't:40,60,60,45,47,75,70,72',
                sizes:     ['440x220', '400x200', '380x190', '360x180', '340x170', '320x160']
            }, this.options);
            chart._set_label('Line chart');
            this._ui.viewport.css({backgroundPosition: '-2px 2px', backgroundColor:'#fff'}); // removes left and bottom line of the image.

            if (this.options.options) {
                this._ui.colorsTab = $.ui.builder.tab(this._ui.options, {title: 'General'}).append(this._widget('resize'));
            }
            this._refresh();
        },
        ls: function() {
            console.log('building line chart');
        }
    });

    // Google Chart Plugins
    $.extend($.ui.googleChart.plugins, {

        // Option panel
        options: {
            _init: function(){
                if (this.options.options) {
                    this._ui.options   = $.ui.builder.tabs().addClass('api-gc-options');
                    this._ui.options.hide().appendTo(this._ui.wrapper);
                    $.ui.builder.button({label: 'Options', icon: 'gear'})
                        .bind('click.googlechart', function(e){
                            chart._ui.options.toggle();
                        })
                        .appendTo(this._ui.toolbar);
                }
            },
            _initialized: function() {
                this._ui.options.tabs();
            }
        },

        // Text link 
        link: {
            _init: function() {
                if (this.options.link) {
                    this._ui.link.appendTo(this._ui.wrapper);
                    $.ui.builder.button({label: 'Link', icon: 'link'})
                        .bind('click.googlechart', function(e){
                            chart._ui.link.toggle();
                        })
                        .appendTo(this._ui.toolbar);
                }
            }
        
        }
             
    });
})(jQuery);

/*
  jQuery ui.builder - 0.1
  http://code.google.com/p/jquery-utils/

  (c) Maxime Haineault <haineault@gmail.com> 
  http://haineault.com

  MIT License (http://www.opensource.org/licenses/mit-license.php

  Dependencies
  ------------
  - jquery.utils.js
  - jquery.strings.js
  - jquery.ui.js
  
*/

(function($){
    var templates = {
        'ui.icon':     '<span class="ui-icon ui-icon-{icon:s}" />',
        'ui.input':    '<input type="{type:s}" class="ui-input ui-input-{type:s} ui-corner-{corner:s}" />',
        'ui.option':   '<option value="{value:s}" class="ui-input-option" selected="{selected:s}">{label:s}</option>',
        'ui.button':   '<a class="ui-state-default ui-corner-{corner:s} ui-button" href="#">{label:s}</a>',
        'ui.toolbar':  '<div class="ui-toolbar ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-{corner:s}" />',
        'ui.tabTitle': '<li class="ui-state-default ui-corner-{titleCorner:s}"><a href="#tabs-{id:s}">{title:s}</a></li>',
        'ui.tabBody':  '<div class="ui-tabs-panel ui-widget-content ui-corner-{panelCorner:s}" />',
        'ui.tabs': [
            '<div class="ui-tabs ui-widget-content ui-corner-{corner:s}">',
                '<ul class="ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-{navCorner:s}" />',
            '</div>'
        ],
        'ui.progressbar': [
            '<div class="ui-corder-{corners:s} ui-progressbar ui-widget ui-widget-content" role="{progressbar:s}" aria-valuemin="{valuemin:d}" aria-valuemax="{valuemax:d}" aria-valuenow="{valuenow:d}">',
                '<div class="ui-progressbar-value ui-widget-header ui-corner-{valCorner:s}" />',
            '</div>'
        ],
        'ui.message': [
            '<div class="ui-widget">',
                '<div class="ui-state-{state:s} ui-corner-{corner:s}">',
                    '<p><span style="float: left; margin-right: 0.3em;" class="ui-icon ui-icon-{icon:s}"/>',
                    '<strong>{title:s}:</strong> {body:s}.</p>',
                '</div>',
            '</div>'
        ]
    };
    
    for (i in templates) { $.tpl(i, templates[i]); }

    $.extend($.ui, {
        builder: {
            icon:    function(o, i) { return $.tpl('ui.icon',    $.extend({icon: 'bullet'}, o), i); },
            input:   function(o, i) { return $.tpl('ui.input',   $.extend({type: 'text', corner: 'none'}, o), i); },
            option:  function(o, i) { return $.tpl('ui.option',  $.extend({selected: 'false'}, o), i); },
            tabs:    function(o, i) { return $.tpl('ui.tabs',    $.extend({corner: 'all', navCorner: 'all'}, o), i); },
            toolbar: function(o, i) { return $.tpl('ui.toolbar', $.extend({corners: 'all'}, o), i); },
            message: function(o, i) { return $.tpl('ui.message', $.extend({corners: 'all', state: 'highlight', icon: 'false', title: '', body: ''}, o), i); },

            button:  function(o) {
                var tpl = $.tpl('ui.button', $.extend({icon: false, label: '', corner: 'all'}, o));
                if (o.icon) { 
                    tpl.prepend($.tpl('ui.icon', {icon: o.icon})); 
                    tpl.addClass('ui-has-icon');
                }
                return tpl;
            },
 
            progressbar: function(o, i) {
                return $.tpl('ui.progressbar', $.extend({ 
                            valuemin: 0, valuemax: 100, valuenow: 
                            0, role: 'progressbar', valcorner: 'left' }, o), i);
            },

            tab: function(tabset, o) {
                var id    = $('.ui-tabs-nav li', tabset).length + 1;
                var opt   = $.extend({title: '', titleCorner: 'top', panelCorner: 'bottom', id: id}, o);
                var title = $.tpl('ui.tabTitle', opt);
                var body  = $.tpl('ui.tabBody',  opt).attr('id', 'tabs-'+ opt.id);
                $(tabset).find('ul.ui-tabs-nav').append(title).end().append(body);
                return body;
            }
        }         
    });
})(jQuery);
