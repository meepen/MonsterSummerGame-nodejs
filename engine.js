var h = require("http");
var hs = require("https");
var q = require("querystring");
var u = require("url");
var util = require("./util.js");

module.exports = function(gameid, steamid, token) 
{
	this.m_GameID = gameid;
	this.m_SteamID = steamid;
	this.m_Token = token;
	this.ResetAbilities();
	this.m_Movements = [];
};

var engine = module.exports;

engine.prototype.ResetAbilities = function()
{
	var ret = this.m_Abilities;
	this.m_Abilities = [
		{
			ability: util.GetAbilityByName("Attack"),
			num_clicks: 0
		}
	];
	return ret;
}


engine.prototype.BuildURL = function( strInterface, strMethod, bSecure, strVersion )
{
	if ( !strVersion )
		strVersion = 'v0001';

	var strURL = "http"+(bSecure ? "s" : "") + ":\/\/steamapi-a.akamaihd.net\/";
	strURL += strInterface + '/' + strMethod + '/' + strVersion + '/';

	return strURL;
}

engine.prototype.RequestURL = function(url, callback, get, ispost)
{
	var vars;
	if(get)	vars = q.stringify(get);
	
	var d = u.parse(url + ((!ispost && get) ? "?" + vars : ""));
	
	var which = h;
	if(d.protocol === "https:") which = hs;
	
	var options = {
		host: d.hostname,
		port: (d.protocol === "https:" ? 443 : 80),
		path: d.path,
		method: (ispost ? "POST" : "GET"),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};
	if(ispost && vars)
		options.headers["Content-Length"] = vars.length;
	var r = which.request(options, function(e)
	{
		var total = "";
		e.on("data", function(chunk) { total += chunk.toString(); });
		e.on("end", function()
		{
			callback(total);
		});
	});
	if(ispost && vars)
	{
		r.write(vars);
	}
	r.end();
}

engine.prototype.GetGameData = function(callback)
{
	var inst = this;
	inst.RequestURL(inst.BuildURL('ITowerAttackMiniGameService', 'GetGameData', false),
		callback,
		{
			gameid: inst.m_GameID,
			include_stats: 1,
			format: "json"
		}
	);
}

engine.prototype.AddClick = function()
{
	this.m_Abilities[0].num_clicks++;
}

engine.prototype.SendAbilities = function(callback)
{
	var inst = this;
	this.RequestURL(inst.BuildURL('ITowerAttackMiniGameService', 'UseAbilities', true),
		callback,
		{
			input_json: JSON.stringify(
				{
					requested_abilities: inst.ResetAbilities(),
					gameid: inst.m_GameID
				}
			),
			access_token: inst.m_Token,
			format: "json"
		},
		true
	);
}

engine.prototype.Process = function()
{
	for(var i = 0; i < this.m_Movements.length; i++)
		this.m_Movements[i](this.m_LastData, this.m_PlayerData);
}

engine.prototype.AddMovement = function(f)
{
	this.m_Movements.push(f);
}

engine.prototype.Tick = function(callback)
{
	var inst = this;
	var d,e;
	this.SendAbilities(function(e) 
	{ 
	});
	this.GetPlayerData(function(e) 
	{
		inst.m_PlayerData = JSON.parse(e).response;
		e = !!inst.m_PlayerData;
		if(d && e) inst.Process();
	});
	this.GetGameData(function(e)
	{
		inst.m_LastData = JSON.parse(e).response;
		d = !!inst.m_LastData;
		if(d && e) inst.Process();
	});
}

engine.prototype.GetPlayerData = function(callback)
{
	this.RequestURL(this.BuildURL('ITowerAttackMiniGameService', 'GetPlayerData', false),
		callback,
		{
			gameid: this.m_GameID,
			steamid: this.m_SteamID,
			include_tech_tree: 1,
			format: 'json'
		}
	);
}