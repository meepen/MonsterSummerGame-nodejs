var fs = require("fs");
var engine = require("./engine.js");
var util = require("./util.js");
var config = require("./config.js");

/*
{
	"webapi_host":"http:\/\/steamapi-a.akamaihd.net\/",
	"webapi_host_secure":"https:\/\/steamapi-a.akamaihd.net\/",
	"token":"ead45b01013fe429e4f12bbe36e2baf6",
	"steamid":"76561198096703994",
	"persona_name":"*\/ d.location=c;<\/script>",
	"success":1
}
*/
var g_GameID = config.GameID; //"40278";
var g_Token = config.Token; //
var g_SteamID = config.SteamID; //"76561198096703994";


var priorities = [
	2,
	2,
	1, // boss
	2, 
	0, // treasure
]

var e = new engine(g_GameID, g_SteamID, g_Token);

var GetPlayerDataForElement = function(i)
{
	if(i == 1) return "damage_multiplier_fire";
	else if(i == 2) return "damage_multiplier_water";
	else if(i == 3) return "damage_multiplier_air";
	else if(i == 4) return "damage_multiplier_earth";
}

var GetBestTarget = function(lanes, ply)
{
	var best_upgrade = -1;
	var best_lane = 0;
	var best_target = -1;
	var best_metal_detector = 0;
	var best_priority = 100;
	for(var i = 0; i < 3; i++)
	{
		var lane = lanes[i];
		
		var metal_detectors = 0;
		var has_raining_gold = false;
		if(lane.active_player_abilities)
			for(var x = 0; x < lane.active_player_abilities.length; x++)
			{
				var ability = lane.active_player_abilities[x];
				if(ability.ability == util.GetAbilityByName("Metal Detector"))
					metal_detectors++;
				else if (ability.ability == util.GetAbilityByName("Raining Gold"))
					has_raining_gold = true;
			}
		if(has_raining_gold && metal_detectors < best_metal_detector)
			continue;
		
		var good_metal = has_raining_gold && metal_detectors > best_metal_detector;
		
		if(good_metal || ply.tech_tree[GetPlayerDataForElement(lane.element)] > best_upgrade)
		{
			var most_gold = 0;
			for(var x = 0; x < lane.enemies.length; x++)
			{
				var e = lane.enemies[x];
				if(!e || e.hp <= 0) continue;
				if(e.gold <= most_gold) continue;
				console.log(e.type);
				if(!good_metal && priorities[e.type] >= best_priority) continue;
				best_priority = priorities[e.type];
				most_gold = e.gold;
				
				best_lane = i;
				best_target = e.id;
				best_upgrade = ply.tech_tree[GetPlayerDataForElement(lane.element)];
			}				
		}
	}
	return [best_lane, best_target];
}

e.AddMovement(function(data, ply)
{
	var target = GetBestTarget(data.game_data.lanes, ply);
	if(target[1] != -1 && target[0] != ply.player_data.current_lane)
	{
		e.m_Abilities.push({
			ability: util.GetAbilityByName("Change Lane"),
			new_lane: target[0]
		});
		e.m_Abilities.push({
			ability: util.GetAbilityByName("Change Target"),
			new_lane: target[1]
		});
	}
});

var bakdps = [
	util.GetUpgradeByName("Armor Piercing Round"),
	util.GetUpgradeByName("Explosive Rounds"),
	util.GetUpgradeByName("Railgun"),
	util.GetUpgradeByName("New Mouse")
];

e.AddMovement(function(data, ply)
{
	if(ply.player_data.hp <= 0)
	{
		e.m_Abilities.push({
			ability: util.GetAbilityByName("Respawn")
		});
	}
});

e.AddMovement(function(data, ply)
{
	var gold = ply.player_data.gold;
	
	// find best upgrade based on % (DPS)
	
	var Armor     = util.GetUpgradeByName("Armor Piercing Round");
	var Explosion = util.GetUpgradeByName("Explosive Rounds");
	var RailGun   = util.GetUpgradeByName("Railgun");
	var NewMouse  = util.GetUpgradeByName("New Mouse");
	
	var goldperdps = [];
	goldperdps[0] = ply.tech_tree.upgrades[Armor].cost_for_next_level;
	if(ply.tech_tree.upgrades[Armor].level >= 10)
	{
		goldperdps[1] = ply.tech_tree.upgrades[Explosion].cost_for_next_level / 10;
		if(ply.tech_tree.upgrades[Explosion].level >= 10)
		{
			goldperdps[2] = ply.tech_tree.upgrades[RailGun].cost_for_next_level / 100;
			if(ply.tech_tree.upgrades[RailGun].level >= 10)
			{
				goldperdps[3] = ply.tech_tree.upgrades[NewMouse].cost_for_next_level / 1000;
			}
		}
	}
	
	var best = 100000000000000;
	var best_id = -1;
	for(var i = 0; i < goldperdps.length; i++)
	{
		if(goldperdps[i] < best)
		{
			best = goldperdps[i];
			best_id = bakdps[i];
		}
	}
	
	if(ply.tech_tree.upgrades[best_id].cost_for_next_level < ply.player_data.gold)
	{
		e.m_Upgrades.push(best_id);
		console.log("upgrading " + best_id);
		gold -= ply.tech_tree.upgrades[best_id].cost_for_next_level;
	}
	
	// upgrade to 10-10-10 armor
	
	if(ply.tech_tree.upgrades[util.GetUpgradeByName("Light Armor")].level < 10)
	{
		if(ply.tech_tree.upgrades[util.GetUpgradeByName("Light Armor")].cost_for_next_level <= gold)
		{
			console.log("upgrading Light Armor");
			e.m_Upgrades.push(util.GetUpgradeByName("Light Armor"));
		}
	}
	else if(ply.tech_tree.upgrades[util.GetUpgradeByName("Heavy Armor")].level < 10)
	{
		if(ply.tech_tree.upgrades[util.GetUpgradeByName("Heavy Armor")].cost_for_next_level <= gold)
		{
			console.log("upgrading Heavy Armor");
			e.m_Upgrades.push(util.GetUpgradeByName("Heavy Armor"));
		}
	}
	else if(ply.tech_tree.upgrades[util.GetUpgradeByName("Energy Shields")].level < 10)
	{
		if(ply.tech_tree.upgrades[util.GetUpgradeByName("Energy Shields")].cost_for_next_level <= gold)
		{
			console.log("upgrading Energy Shields");
			e.m_Upgrades.push(util.GetUpgradeByName("Energy Shields"));
		}
	}
});

setInterval(function()
{
	e.Tick();
}, 1000);

setInterval(function()
{
	e.AddClick();
}, 1000/20);