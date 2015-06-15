
var Upgrades = [
	{
		type: 0,
		name: "Light Armor"
	},
	{
		type: 3,
		name: "Fire"
	},
	{
		type: 4,
		name: "Water"
	},
	{
		type: 6,
		name: "Earth"
	},
	{
		type: 5,
		name: "Air"
	},
	{
		type: 8,
		name: "Heavy Armor"
	},
	{
		type: 20,
		name: "Energy Shields"
	},
	{
		type: 1,
		name: "Auto-fire Cannon"
	},
	{
		type: 9,
		name: "Advanced Targetting"
	},
	{
		type: 21,
		name: "Farming Equipment"
	},
	{
		type: 2,
		name: "Armor Piercing Round"
	},
	{
		type: 10,
		name: "Explosive Rounds"
	},
	{
		type: 22,
		name: "Railgun"
	},
	{
		type: 25,
		name: "New Mouse"
	},
	{
		type: 28,
		name: "Titanium Mouse Button"
	},
	{
		type: 7,
		name: "Lucky Shot"
	},
	{
		type: 19,
		name: "Boss Loot"
	}
];

var Abilities = [
	{
		type: 1,
		name: "Attack"
	},
	{
		type: 2,
		name: "Change Lane"
	},
	{
		type: 3,
		name: "Respawn"
	},
	{
		type: 4,
		name: "Change Target"
	},
	{
		type: 5,
		name: "Morale Booster"
	},
	{
		type: 6,
		name: "Good Luck Charms"
	},
	{
		type: 7,
		name: "Medics"
	},
	{
		type: 8,
		name: "Metal Detector"
	},
	{
		type: 9,
		name: "Decrease Cooldowns"
	},
	{
		type: 10,
		name: "Tactical Nuke"
	},
	{
		type: 11,
		name: "Cluster Bomb"
	},
	{
		type: 12,
		name: "Napalm"
	},
	{
		type: 13,
		name: "Resurrection"
	},
	{
		type: 14,
		name: "Cripple Spawner"
	},
	{
		type: 15,
		name: "Cripple Monster"
	},
	{
		type: 16,
		name: "Max Elemental Damage"
	},
	{
		type: 17,
		name: "Raining Gold"
	},
	{
		type: 18,
		name: "Crit"
	},
	{
		type: 19,
		name: "Pumped Up"
	},
	{
		type: 19,
		name: "Metal Detector"
	},
	{
		type: 20,
		name: "Throw Money at Screen"
	},
	{
		type: 21,
		name: "GOD MODE"
	},
	{
		type: 22,
		name: "Treasure!"
	},
	{
		type: 23,
		name: "Steal Health"
	},
	{
		type: 24,
		name: "Reflect Damage"
	},
];

exports.GetAbilityByName = function(n)
{
	for(var i = Abilities.length - 1; i >= 0; i--)
		if(Abilities[i].name === n)
			return Abilities[i].type;
}
exports.GetUpgradeByName = function(n)
{
	for(var i = Upgrades.length - 1; i >= 0; i--)
		if(Upgrades[i].name === n)
			return Upgrades[i].type;
}