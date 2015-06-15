var h = require("http");
var hs = require("https");
var q = require("querystring");
var u = require("url");
var util = require("./util.js");
var fs = require("fs");

module.exports = function(gameid, steamid, token) 
{
	this.m_GameID = gameid;
	this.m_SteamID = steamid;
	this.m_Token = token;
	this.ResetAbilities();
	this.m_Movements = [];
	this.m_Upgrades = [];
	
	this.UseBadgePoints(function() {});
	
	var inst = this;
	this.ticking = true;
	this.GetTuningData(function(c) {
		inst.m_Tuning = JSON.parse(JSON.parse(c).response.json);
		fs.writeFile("xd.txt", JSON.stringify(inst.m_Tuning), function() { });
		inst.ticking = false;
		console.log("Initialized!");
	});
};

var engine = module.exports;

engine.prototype.GetDPSUpgrades = function(id)
{
	var ret = [];
	for(var k in this.m_Tuning.upgrades)
	{
		var v = this.m_Tuning.upgrades[k];
		if(parseInt(v.type) == 2) // damage
		{
			ret.push(parseInt(k));
		}
	}
	return ret;
}

engine.prototype.IsUpgradeUnlocked = function(upgr)
{
	var v = this.m_Tuning.upgrades[upgr];
	var depend = v.required_upgrade;
	var ply = this.m_PlayerData;
	if(!depend || ply.tech_tree.upgrades[depend]
		&& ply.tech_tree.upgrades[depend].level >= v.required_upgrade_level)
	{
		return true;
	}
	return false;
}

engine.prototype.GetUpgradeLevel = function(upgr)
{
	return (this.GetUpgradeData(upgr) ? this.GetUpgradeData(upgr).level : 0);
}
engine.prototype.GetUpgradeCost = function(upgr)
{
	function CalcExponentialTuningValve( level, coefficient, base )
	{
		return ( coefficient * ( Math.pow( base, level ) ) );
	}
	
	return CalcExponentialTuningValve(this.GetUpgradeData(upgr) ? this.GetUpgradeData(upgr).level : 0, this.m_Tuning.upgrades[upgr].cost, 
			this.m_Tuning.upgrades[upgr].cost_exponential_base);
}


engine.prototype.GetUpgradeData = function(upgr)
{
	for(var k in this.m_PlayerData.tech_tree.upgrades)
	{
		var v = this.m_PlayerData.tech_tree.upgrades[k];
		if(v.upgrade == upgr) return v;
	}
}

engine.prototype.GetMultiplier = function(upgr)
{
	return this.m_Tuning.upgrades[upgr].multiplier;
}

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

engine.prototype.DoUpgrades = function(callback)
{
	this.RequestURL(this.BuildURL( 'ITowerAttackMiniGameService', 'ChooseUpgrade', true ),
		callback,
		{
			access_token: this.m_Token,
			format: "json",
			input_json: JSON.stringify({
				gameid: this.m_GameID,
				upgrades: this.m_Upgrades
			})
		},
		true
	);
	this.m_Upgrades = [];
}

engine.prototype.UseBadgePoints = function()
{
	var items = [
		util.GetAbilityByName("Treasure!"),
		util.GetAbilityByName("Treasure!"),
		util.GetAbilityByName("Treasure!"),
	]
	for(var i = 0; i < 3000;i++)
		items.push(util.GetAbilityByName("Crit"));
	this.RequestURL(this.BuildURL('ITowerAttackMiniGameService', 'UseBadgePoints', true),
		function() {},
		{
			input_json: JSON.stringify({
				gameid: this.m_GameID,
				//todo: make not shit
				ability_items: items
			}),
			access_token: this.m_Token,
			format: "json"
		},
		true
	);
}

engine.prototype.Process = function()
{
	for(var i = 0; i < this.m_Movements.length; i++)
		this.m_Movements[i](this.m_LastData, this.m_PlayerData);
	this.DoUpgrades(function() { });
	this.ticking = false;
}

engine.prototype.AddMovement = function(f)
{
	this.m_Movements.push(f);
}

engine.prototype.GetTuningData = function(callback)
{
	this.RequestURL(
		this.BuildURL('ITowerAttackMiniGameService', 'GetTuningData', true, null),
		callback, 
		{
			game_type: 1,
			gameid: this.m_GameID,
			access_token: this.m_Token,
			format: "json"
		}
	);
}

engine.prototype.Tick = function(callback)
{
	if(!this.ticking)
	{
		this.ticking = true;
		var inst = this;
		this.SendAbilities(function(e) 
		{ 
		});
		inst.m_LastData = false;
		inst.m_PlayerData = false;
		this.GetPlayerData(function(e) 
		{
			inst.m_PlayerData = JSON.parse(e).response;
			if(inst.m_LastData && inst.m_PlayerData) inst.Process();
		});
		this.GetGameData(function(e)
		{
			inst.m_LastData = JSON.parse(e).response;
			if(inst.m_LastData && inst.m_PlayerData) inst.Process();
		});
	}
	
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