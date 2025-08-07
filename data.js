// data.js
function getTours(){
  return [
    {
      website:'SafariBookings',
      tourName:'Savannah Explorer',
      luxuryLevel:'camp',
      costRange:'$1,200–$1,800',
      animals:{lion:.8,elephant:.6,cheetah:.3,'cape buffalo':.5},
      activities:['night drive','guided walking safari']
    },
    {
      website:'GreatAfrica',
      tourName:'Luxury Migration Tour',
      luxuryLevel:'fancy',
      costRange:'$4,500–$7,000',
      animals:{lion:.9,elephant:.8,cheetah:.4},
      activities:['great migration','hot-air balloon flight']
    },
    {
      website:'WildLife Safaris',
      tourName:'Glamping Adventure',
      luxuryLevel:'glamp',
      costRange:'$3,000–$4,200',
      animals:{lion:.7,elephant:.7,giraffe:.6},
      activities:['mokoro excursion','sleep-out under the stars']
    }
  ];
}
module.exports={ getTours };
