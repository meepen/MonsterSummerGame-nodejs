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
	2, // spawner
	3, // creeper
	1, // boss
	2, // miniboss
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
		
		var good_metal = has_raining_gold && metal_detectors > best_metal_detector;
		
		if(good_metal || ply.tech_tree[GetPlayerDataForElement(lane.element)] > best_upgrade)
		{
			var most_gold = 0;
			for(var x = 0; x < lane.enemies.length; x++)
			{
				var e = lane.enemies[x];
				if(!e || e.hp <= 0) continue;
				if(priorities[e.type] > best_priority) continue;
				else if(priorities[e.type] == best_priority && e.gold <= most_gold) continue;
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

// lanes and autoshoot
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

// respawn
e.AddMovement(function(data, ply)
{
	if(ply.player_data.hp <= 0)
	{
		e.m_Abilities.push({
			ability: util.GetAbilityByName("Respawn")
		});
	}
});


// upgrades
e.AddMovement(function(data, ply)
{
	var gold = ply.player_data.gold;
	
	// find best upgrade based on % (DPS)
	
	var dps_upgrades = e.GetDPSUpgrades();
	var goldperdps = [];
	
	for(var i = dps_upgrades.length - 1; i >= 0; i--)
	{
		
		if(!e.IsUpgradeUnlocked(dps_upgrades[i]))
			dps_upgrades.splice(i, 1);
		else
		{
			goldperdps.push({
				gold: e.GetUpgradeCost(dps_upgrades[i]),
				type: dps_upgrades[i],
				gpdps: e.GetUpgradeCost(dps_upgrades[i]) / (ply.tech_tree.base_dps * e.GetMultiplier(dps_upgrades[i]))
			});
		}
	}
	
	// todo: later
    var hashCode = function(str) {
        var t = 0,
            i, char;
        if (0 === str.length) {
            return t;
        }

        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            t = (t << 5) - t + char;
            t &= t;
        }

        return t;
    };

    var elem = Math.abs(hashCode(g_SteamID) % 4);
	
	function CalcExponentialTuningValve( level, coefficient, base )
	{
		return ( coefficient * ( Math.pow( base, level ) ) );
	}
	
	var amt = e.GetUpgradeLevel(util.GetUpgradeByName("Fire")) + e.GetUpgradeLevel(util.GetUpgradeByName("Water")) + 
		e.GetUpgradeLevel(util.GetUpgradeByName("Earth")) + e.GetUpgradeLevel(util.GetUpgradeByName("Air"));
		console.log(amt);
	var exp = 2.2;
	var nElementalCost = Math.floor(10 * CalcExponentialTuningValve( amt, 50, exp)) / 10;

	var elems = [
		util.GetUpgradeByName("Fire"), util.GetUpgradeByName("Water"), 
		util.GetUpgradeByName("Earth"), util.GetUpgradeByName("Air")
	];
	goldperdps.push({
		type: elems[elem],
		gpdps: nElementalCost / (ply.tech_tree.dps * 1.5 / 4),
		gold: nElementalCost 
	});
	
	goldperdps.push({
		type: util.GetUpgradeByName("Lucky Shot"),
		gpdps: e.GetUpgradeCost(util.GetUpgradeByName("Lucky Shot")) / (
			Math.min(1, ply.tech_tree.crit_percentage) * ply.tech_tree.dps * 1.5
		),
		gold: e.GetUpgradeCost(util.GetUpgradeByName("Lucky Shot"))
	});
	console.log(goldperdps);
	
	var best = 100000000000000;
	var gold_needed = 1000000000000;
	var best_id = -1;
	for(var i = 0; i < goldperdps.length; i++)
	{
		var v = goldperdps[i];
		if(v.gpdps < best)
		{
			best_id = v.type;
			best = v.gpdps;
			gold_needed = v.gold;
		}
	}
	if(gold_needed < gold)
	{
		gold -= gold_needed;
		e.m_Upgrades.push(best_id);
		console.log("UPGRADED: " + best_id);
	}
	
	// upgrade to 10-10-5 armor
	
	if(e.GetUpgradeData(util.GetUpgradeByName("Light Armor")).level < 10)
	{
		if(e.GetUpgradeData(util.GetUpgradeByName("Light Armor")).cost_for_next_level <= gold)
		{
			gold -= e.GetUpgradeData(util.GetUpgradeByName("Light Armor")).cost_for_next_level;
			console.log("upgrading Light Armor");
			e.m_Upgrades.push(util.GetUpgradeByName("Light Armor"));
		}
	}
	else if(e.GetUpgradeData(util.GetUpgradeByName("Heavy Armor")).level < 10)
	{
		if(e.GetUpgradeData(util.GetUpgradeByName("Heavy Armor")).cost_for_next_level <= gold)
		{
			gold -= e.GetUpgradeData(util.GetUpgradeByName("Heavy Armor")).cost_for_next_level;
			
			console.log("upgrading Heavy Armor");
			e.m_Upgrades.push(util.GetUpgradeByName("Heavy Armor"));
		}
	}
	else if(e.GetUpgradeData(util.GetUpgradeByName("Energy Shields")).level < 5)
	{
		if(e.GetUpgradeData(util.GetUpgradeByName("Energy Shields")).cost_for_next_level <= gold)
		{
			gold -= e.GetUpgradeData(util.GetUpgradeByName("Energy Shields")).cost_for_next_level;
			
			console.log("upgrading Energy Shields");
			e.m_Upgrades.push(util.GetUpgradeByName("Energy Shields"));
		}
	}
	
	if(e.GetUpgradeData(util.GetUpgradeByName("Auto-fire Cannon")).level < 20 
		&& e.GetUpgradeData(util.GetUpgradeByName("Auto-fire Cannon")).cost_for_next_level < gold)
	{
		console.log("Upgrading Auto-fire Cannon");
		e.m_Upgrades.push(util.GetUpgradeByName("Auto-fire Cannon"));
	}
	else if(e.GetUpgradeData(util.GetUpgradeByName("Auto-fire Cannon")).level >= 20)
	{
		if(e.GetUpgradeData(util.GetUpgradeByName("Boss Loot")).level < 20 
			&& e.GetUpgradeData(util.GetUpgradeByName("Boss Loot")).cost_for_next_level < gold)
		{
			console.log("Upgrading Boss Loot");
			e.m_Upgrades.push(util.GetUpgradeByName("Boss Loot"));
		}
	}
	
});

// abilities
e.AddMovement(function(data, ply)
{
	// medics
	
	/*
	this.m_Abilities.push({
		ability: id
	});
	*/
	
	var HasAbilityItem = function(ply, id)
	{
		var techtree = ply.tech_tree;
		//console.log(id);
		for(var k in techtree.ability_items)
		{
			var v = techtree.ability_items[k];
			if(v.ability == id)
			{
				if(v.quantity > 0)
					return true;
				else return false;
			}
		}
		return false;
	}
	var HasAbility = function(ply, id)
	{
		return (ply.tech_tree.unlocked_abilities_bitfield & (1<<id)) != 0 || HasAbilityItem(ply, id);
	}
	
	var IsAbilityActive = function(ply, id)
	{
		return (ply.player_data.active_abilities_bitfield & (1 << id)) != 0
	}
	
	var UseAbilityIfAble = function(p, ability)
	{
		var id = util.GetAbilityByName(ability);
		if(HasAbility(p, id) && !IsAbilityActive(p, id))
		{
			e.m_Abilities.push({
				ability: id
			});
			console.log("Used " + ability);
		}
	}
	
	UseAbilityIfAble(ply, "Treasure!");
	
	if(data.game_data.level % 200 != 0)
	{
		// medics
		if(ply.player_data.hp / ply.tech_tree.max_hp < .4)
			UseAbilityIfAble(ply, "Medics");
		// crit
		UseAbilityIfAble(ply, "Crit");
		
		// nuke

		UseAbilityIfAble(ply, "Tactical Nuke");
		UseAbilityIfAble(ply, "Pumped Up");
		UseAbilityIfAble(ply, "Napalm");
		UseAbilityIfAble(ply, "Cluster Bomb");
		UseAbilityIfAble(ply, "Good Luck Charms");
		UseAbilityIfAble(ply, "Morale Booster");
		UseAbilityIfAble(ply, "Good Luck Charms");
		UseAbilityIfAble(ply, "Max Elemental Damage");
		
	}
	else
	{
		var IsAbilityUsed = function(game, ply, ability)
		{
			var abilities = game.game_data.lanes[ply.player_data.current_lane].active_player_abilities;
			
			for(var k in abilities) 
			{
				var v = abilities[k];
				if(v.ability == util.GetAbilityByName(ability))
					return true;
			}
		}
		if(!IsAbilityUsed(data, ply, "Raining Gold"))
			UseAbilityIfAble(ply, "Raining Gold");
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