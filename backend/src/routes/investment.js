const express = require('express');
const { pool, query } = require('../db');
const { auth } = require('../middleware/auth');
const YahooFinance = require('yahoo-finance2').default;
const { STOCK_SYMBOLS } = require('../services/stockList');

const router = express.Router();

// USD to HUF árfolyam
const USD_TO_HUF = 360;

// Yahoo Finance példány
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Logó URL generálása részvény szimbólum alapján
function getLogoUrl(symbol, quote = null) {
  // 1. Yahoo Finance logó (ha elérhető)
  if (quote && quote.logoUrl) {
    return quote.logoUrl;
  }
  
  // 2. Domain mapping a legnépszerűbb részvényekhez
  const domainMap = {
    'aapl': 'apple.com', 'msft': 'microsoft.com', 'googl': 'google.com', 'amzn': 'amazon.com',
    'meta': 'meta.com', 'tsla': 'tesla.com', 'nvda': 'nvidia.com', 'jpm': 'jpmorgan.com',
    'v': 'visa.com', 'unh': 'unitedhealthgroup.com', 'nflx': 'netflix.com', 'amd': 'amd.com',
    'intc': 'intel.com', 'crm': 'salesforce.com', 'orcl': 'oracle.com', 'adbe': 'adobe.com',
    'avgo': 'broadcom.com', 'qcom': 'qualcomm.com', 'txn': 'ti.com', 'now': 'servicenow.com',
    'intu': 'intuit.com', 'mu': 'micron.com', 'amat': 'appliedmaterials.com', 'lrcx': 'lamresearch.com',
    'klac': 'kla.com', 'snps': 'synopsys.com', 'cdns': 'cadence.com', 'anet': 'arista.com',
    'panw': 'paloaltonetworks.com', 'crwd': 'crowdstrike.com', 'zs': 'zscaler.com', 'net': 'cloudflare.com',
    'ddog': 'datadoghq.com', 'ftnt': 'fortinet.com', 'okta': 'okta.com', 'team': 'atlassian.com',
    'zm': 'zoom.us', 'docu': 'docusign.com', 'coin': 'coinbase.com', 'shop': 'shopify.com',
    'sq': 'square.com', 'pypl': 'paypal.com', 'hood': 'robinhood.com', 'sofi': 'sofi.com',
    'afrm': 'affirm.com', 'mdb': 'mongodb.com', 'estc': 'elastic.co', 'splk': 'splunk.com',
    'wday': 'workday.com', 'veev': 'veeva.com', 'docn': 'digitalocean.com', 'frog': 'jfrog.com',
    'gtlb': 'gitlab.com', 'asan': 'asana.com', 'bill': 'bill.com', 'frsh': 'freshworks.com',
    'appn': 'appian.com', 'alrm': 'alarm.com', 'mime': 'mimecast.com', 'qlys': 'qualys.com',
    'rpd': 'rapid7.com', 'tenb': 'tenable.com', 'vrns': 'varonis.com', 'zen': 'zendesk.com',
    'zuo': 'zuora.com', 'bac': 'bankofamerica.com', 'wfc': 'wellsfargo.com', 'gs': 'goldmansachs.com',
    'ms': 'morganstanley.com', 'c': 'citigroup.com', 'blk': 'blackrock.com', 'schw': 'schwab.com',
    'axp': 'americanexpress.com', 'cof': 'capitalone.com', 'tfc': 'truist.com', 'pnc': 'pnc.com',
    'usb': 'usbank.com', 'bk': 'bnymellon.com', 'stt': 'statestreet.com', 'cfg': 'citizensbank.com',
    'key': 'key.com', 'hban': 'huntington.com', 'mtb': 'mtb.com', 'zion': 'zionbank.com',
    'fitb': 'fifththird.com', 'rf': 'regions.com', 'cma': 'comerica.com', 'wtfc': 'wtfc.com',
    'onb': 'oldnational.com', 'fnb': 'fnb.com', 'homb': 'homebancshares.com', 'ubsh': 'ubsh.com',
    'tcbi': 'texascapitalbank.com', 'fbnc': 'firstbank.com', 'fibk': 'firstinterstatebank.com',
    'jnj': 'jnj.com', 'pfe': 'pfizer.com', 'abbv': 'abbvie.com', 'tmo': 'thermofisher.com',
    'abt': 'abbott.com', 'dhr': 'danaher.com', 'bmy': 'bms.com', 'amgn': 'amgen.com',
    'gild': 'gilead.com', 'regn': 'regeneron.com', 'vrtx': 'vertexpharma.com', 'biib': 'biogen.com',
    'ilmn': 'illumina.com', 'mrna': 'modernatx.com', 'bntx': 'biontech.de', 'nvax': 'novavax.com',
    'cvs': 'cvshealth.com', 'ci': 'cigna.com', 'hum': 'humana.com', 'cnc': 'centene.com',
    'elv': 'elevancehealth.com', 'hca': 'hcahealthcare.com', 'thc': 'tenethealth.com', 'uhs': 'uhs.com',
    'mrk': 'merck.com', 'lly': 'lilly.com', 'nvs': 'novartis.com', 'sny': 'sanofi.com',
    'gsk': 'gsk.com', 'tak': 'takeda.com', 'teva': 'teva.com', 'myl': 'mylan.com', 'zts': 'zoetis.com',
    'wmt': 'walmart.com', 'hd': 'homedepot.com', 'mcd': 'mcdonalds.com', 'nke': 'nike.com',
    'sbux': 'starbucks.com', 'tgt': 'target.com', 'low': 'lowes.com', 'cost': 'costco.com',
    'dg': 'dollargeneral.com', 'tjx': 'tjx.com', 'rost': 'rossstores.com', 'bby': 'bestbuy.com',
    'lulu': 'lululemon.com', 'dks': 'dickssportinggoods.com', 'anf': 'abercrombie.com', 'aeo': 'ae.com',
    'gps': 'gap.com', 'dis': 'disney.com', 'cmcsa': 'comcast.com', 'vz': 'verizon.com',
    't': 'att.com', 'chtr': 'charter.com', 'para': 'paramount.com', 'wbd': 'wbd.com',
    'ebay': 'ebay.com', 'etsy': 'etsy.com', 'w': 'wayfair.com', 'ostk': 'overstock.com',
    'rvlv': 'revolve.com', 'real': 'realreal.com', 'cvna': 'carvana.com', 'vrm': 'vroom.com',
    'ftch': 'farfetch.com', 'cat': 'caterpillar.com', 'ge': 'ge.com', 'hon': 'honeywell.com',
    'de': 'deere.com', 'cmi': 'cummins.com', 'emr': 'emerson.com', 'etn': 'eaton.com',
    'ph': 'parker.com', 'rok': 'rockwellautomation.com', 'ame': 'ametek.com', 'ir': 'ingersollrand.com',
    'dov': 'dover.com', 'fast': 'fastenal.com', 'gww': 'grainger.com', 'wwd': 'wesco.com',
    'aos': 'aosmith.com', 'awi': 'armstrongworldindustries.com', 'axon': 'axon.com', 'azek': 'azek.com',
    'bcc': 'boisecascade.com', 'becn': 'beacon.com', 'bldr': 'buildersfirstsource.com', 'bmch': 'bmcstock.com',
    'bxc': 'bluelinx.com', 'carr': 'carrier.com', 'cswi': 'cswindustries.com', 'ctos': 'customonline.com',
    'cwst': 'casella.com', 'xom': 'exxonmobil.com', 'cvx': 'chevron.com', 'cop': 'conocophillips.com',
    'slb': 'slb.com', 'eog': 'eogresources.com', 'mpc': 'marathonpetroleum.com', 'psx': 'phillips66.com',
    'vlo': 'valero.com', 'hes': 'hess.com', 'fang': 'diamondbackenergy.com', 'ovv': 'ovintiv.com',
    'ctra': 'coterra.com', 'mro': 'marathonoil.com', 'dvn': 'devonenergy.com', 'apa': 'apa.com',
    'nov': 'nov.com', 'hal': 'halliburton.com', 'oxy': 'oxy.com', 'mur': 'murphyoilcorp.com',
    'pdc': 'pdce.com', 'swn': 'southwesternenergy.com', 'rrc': 'rangeresources.com', 'crk': 'comstockresources.com',
    'mtdr': 'matadorresources.com', 'sm': 'sm-energy.com', 'vtle': 'vitalenergy.com', 'wti': 'wti.com',
    'xec': 'cimarex.com', 'aroc': 'archrock.com', 'hlx': 'helix.com', 'nbr': 'nabors.com',
    'pump': 'propetro.com', 'res': 'rpc.com', 'wttr': 'selectwater.com', 'whd': 'cactus.com',
    'nee': 'nexteraenergy.com', 'duk': 'duke-energy.com', 'so': 'southerncompany.com', 'aep': 'aep.com',
    'sre': 'sempra.com', 'exc': 'exelon.com', 'xel': 'xcelenergy.com', 'es': 'evergy.com',
    'etr': 'entergy.com', 'peg': 'publicserviceenterprise.com', 'ed': 'conedison.com', 'eix': 'edison.com',
    'fe': 'firstenergycorp.com', 'aee': 'ameren.com', 'cms': 'cmsenergy.com', 'cnp': 'centerpointenergy.com',
    'lnt': 'alliantenergy.com', 'ni': 'nisource.com', 'amt': 'americantower.com', 'pld': 'prologis.com',
    'eqix': 'equinix.com', 'psa': 'publicstorage.com', 'well': 'welltower.com', 'spg': 'simon.com',
    'o': 'realtyincome.com', 'dlr': 'digitalrealty.com', 'expi': 'expworldholdings.com', 'cbre': 'cbre.com',
    'jll': 'jll.com', 'cwk': 'cushmanwakefield.com', 'cube': 'cubesmart.com', 'stor': 'stor.com',
    'stag': 'stagindustrial.com', 'eprt': 'essentialproperties.com', 'fr': 'firstindustrial.com', 'kref': 'kkr.com',
    'lin': 'linde.com', 'apd': 'airproducts.com', 'shw': 'sherwin-williams.com', 'ecl': 'ecolab.com',
    'dd': 'dupont.com', 'ppg': 'ppg.com', 'fcx': 'fcx.com', 'nem': 'newmont.com', 'vale': 'vale.com',
    'aa': 'alcoa.com', 'x': 'ussteel.com', 'clf': 'clevelandcliffs.com', 'stld': 'steeldynamics.com',
    'nue': 'nucor.com', 'cmc': 'commercialmetals.com', 'rs': 'reliantsteel.com', 'cenx': 'centuryaluminum.com',
    'zeus': 'olympicsteel.com', 'foxa': 'fox.com', 'lsxmk': 'libertymedia.com', 'lsxma': 'libertymedia.com',
    'lsxmb': 'libertymedia.com', 'batrk': 'libertymedia.com', 'batra': 'libertymedia.com', 'batrb': 'libertymedia.com',
    'pg': 'pg.com', 'ko': 'coca-cola.com', 'pep': 'pepsico.com', 'dltr': 'dollartree.com',
    'five': 'fivebelow.com', 'olli': 'olli.com', 'bj': 'bjs.com', 'big': 'biglots.com',
    'hibb': 'hibbett.com', 'aso': 'academy.com', 'boot': 'bootbarn.com', 'btc-usd': 'bitcoin.org',
    'eth-usd': 'ethereum.org', 'bnb-usd': 'binance.com', 'sol-usd': 'solana.com', 'ada-usd': 'cardano.org',
    'xrp-usd': 'ripple.com', 'doge-usd': 'dogecoin.com', 'dot-usd': 'polkadot.network', 'avax-usd': 'avax.network',
    'matic-usd': 'polygon.technology', 'link-usd': 'chain.link', 'uni-usd': 'uniswap.org',
    'ltc-usd': 'litecoin.org', 'bch-usd': 'bitcoincash.org', 'etc-usd': 'ethereumclassic.org',
    'xlm-usd': 'stellar.org', 'atom-usd': 'cosmos.network', 'algo-usd': 'algorand.com',
    'near-usd': 'near.org', 'ftm-usd': 'fantom.foundation', 'sand-usd': 'sandbox.game',
    'mana-usd': 'decentraland.org', 'axs-usd': 'axieinfinity.com', 'gala-usd': 'gala.com',
    'spy': 'spdrs.com', 'qqq': 'invesco.com', 'iwm': 'ishares.com', 'dia': 'spdrs.com',
    'gld': 'spdrs.com', 'slv': 'ishares.com', 'uso': 'uscommodityfunds.com', 'tlt': 'ishares.com',
    'arkk': 'ark-funds.com', 'arkq': 'ark-funds.com', 'arkg': 'ark-funds.com', 'arkw': 'ark-funds.com',
    'arkf': 'ark-funds.com', 'spxl': 'direxion.com', 'tqqq': 'proshares.com', 'sqqq': 'proshares.com',
    'vti': 'vanguard.com', 'voo': 'vanguard.com', 'vea': 'vanguard.com', 'vwo': 'vanguard.com',
    'bnd': 'vanguard.com', 'agg': 'ishares.com', 'hyg': 'ishares.com', 'lqd': 'ishares.com',
    'tip': 'ishares.com', 'efa': 'ishares.com', 'eem': 'ishares.com', 'iefa': 'ishares.com',
    'iemg': 'ishares.com', 'acwi': 'ishares.com', 'acwx': 'ishares.com', 'vgk': 'vanguard.com',
    'vpl': 'vanguard.com', 'vxus': 'vanguard.com', 'baba': 'alibabagroup.com', 'jd': 'jd.com',
    'pdd': 'pddholdings.com', 'bidu': 'baidu.com', 'tme': 'tencentmusic.com', 'nio': 'nio.com',
    'xpev': 'xpeng.com', 'li': 'lixiang.com', 'bili': 'bilibili.com', 'tal': 'tal.com',
    'edu': 'neworiental.org', 'wb': 'weibo.com', 'doyu': 'douyu.com', 'huya': 'huya.com',
    'yy': 'yy.com', 'momo': 'momo.com', 'vips': 'vip.com', 'bz': 'bilibili.com', 'didi': 'didiglobal.com',
    'asml': 'asml.com', 'tsm': 'tsmc.com', 'sony': 'sony.com', 'tm': 'toyota.com',
    'hmc': 'honda.com', 'nvo': 'novonordisk.com', 'sap': 'sap.com', 'ul': 'unilever.com',
    'bp': 'bp.com', 'shel': 'shell.com', 'tte': 'totalenergies.com', 'eni': 'eni.com',
    'rep': 'repsol.com', 'eqnr': 'equinor.com', 'stla': 'stellantis.com', 'vow3': 'volkswagen.com',
    'bmw': 'bmw.com', 'dai': 'daimler.com', 'mbg': 'mercedes-benz.com', 'alv': 'allianz.com',
    'con': 'continental.com', 'ads': 'adidas.com', 'db': 'db.com', 'cs': 'credit-suisse.com',
    'ubs': 'ubs.com', 'ing': 'ing.com', 'f': 'ford.com', 'gm': 'gm.com',
    'rivn': 'rivian.com', 'lcid': 'lucidmotors.com', 'ford': 'ford.com', 'ride': 'lordstownmotors.com',
    'wkhs': 'workhorse.com', 'arvl': 'arrival.com', 'goev': 'canoo.com', 'cenn': 'cenntro.com',
    'ffie': 'faradayfuture.com', 'rblx': 'roblox.com', 'u': 'unity.com', 'pltr': 'palantir.com',
    'snow': 'snowflake.com', 'dash': 'doordash.com', 'abnb': 'airbnb.com', 'uber': 'uber.com',
    'lyft': 'lyft.com', 'grab': 'grab.com', 'ttwo': 'take2games.com', 'ea': 'ea.com',
    'atvi': 'activision.com', 'ubsfy': 'ubisoft.com', 'ntdoy': 'nintendo.com', 'msgm': 'msg.com',
    'dkng': 'draftkings.com', 'penn': 'pennentertainment.com', 'sail': 'sailpoint.com', 's': 'sentinelone.com',
    'rdwr': 'radware.com', 'onto': 'ontologics.com', 'uctt': 'ultra-clean.com', 'acls': 'axcelis.com',
    'form': 'formfactor.com', 'plab': 'photronics.com', 'aeis': 'advancedenergy.com', 'amba': 'ambarella.com',
    'mrvl': 'marvell.com', 'swks': 'skyworks.com', 'mchp': 'microchip.com', 'on': 'onsemi.com',
    'diod': 'diodes.com', 'algm': 'allegromicro.com', 'isrg': 'intuitivesurgical.com', 'bsx': 'bostonscientific.com',
    'bax': 'baxter.com', 'ew': 'edwards.com', 'zbh': 'zimmerbiomet.com', 'holx': 'hologic.com',
    'algn': 'align.com', 'nvst': 'envista.com', 'brk-b': 'berkshirehathaway.com', 'brk-a': 'berkshirehathaway.com',
    'aig': 'aig.com', 'all': 'allstate.com', 'cb': 'chubb.com', 'trv': 'travelers.com',
    'pgr': 'progressive.com', 'pru': 'prudential.com', 'met': 'metlife.com', 'afl': 'aflac.com',
    'bhf': 'brighthousefinancial.com', 'cinf': 'cincinnati.com', 'fnf': 'fnf.com', 'gl': 'globe.com',
    'hig': 'hartford.com', 'lnc': 'lincoln.com', 'pfg': 'principal.com', 'unm': 'unum.com',
    'dal': 'delta.com', 'ual': 'united.com', 'aal': 'aa.com', 'luv': 'southwest.com',
    'jblu': 'jetblue.com', 'save': 'spirit.com', 'alk': 'alaskaair.com', 'ha': 'hawaiianairlines.com',
    'fdx': 'fedex.com', 'ups': 'ups.com', 'xpo': 'xpo.com', 'chrw': 'chrobinson.com',
    'knx': 'knight-swift.com', 'arcb': 'arcbest.com', 'odfl': 'odfl.com', 'jbht': 'jbhunt.com',
    'wern': 'werner.com', 'rxo': 'rxo.com', 'cmg': 'chipotle.com', 'yum': 'yum.com',
    'yumc': 'yumchina.com', 'dpz': 'dominos.com', 'pzza': 'pizzahut.com', 'wen': 'wendys.com',
    'jack': 'jackinthebox.com', 'boja': 'bojangles.com', 'blmn': 'bloominbrands.com', 'din': 'dinebrands.com',
    'cake': 'cheesecake.com', 'chuy': 'chuys.com', 'fwrg': 'firstwatch.com', 'loco': 'elpolloloco.com',
    'ndls': 'noodles.com', 'ruth': 'ruthschris.com', 'mar': 'marriott.com', 'hlt': 'hilton.com',
    'h': 'hyatt.com', 'wh': 'wyndham.com', 'expe': 'expedia.com', 'bkng': 'booking.com',
    'tcom': 'trip.com', 'trip': 'tripadvisor.com', 'mmyt': 'makemytrip.com', 'snap': 'snap.com',
    'pins': 'pinterest.com', 'rddt': 'reddit.com', 'bmbl': 'bumble.com', 'mtch': 'match.com',
    'iac': 'iac.com', 'angi': 'angi.com', 'vrsk': 'verisk.com', 'tru': 'transunion.com',
    'mnst': 'monster.com', 'kdp': 'keurigdrpepper.com', 'fizz': 'nationalbeverage.com', 'celh': 'celcius.com',
    'bgs': 'bgs.com', 'cag': 'conagra.com', 'cpb': 'campbellsoup.com', 'gis': 'generalmills.com',
    'hrl': 'hormelfoods.com', 'sjm': 'jm.com', 'k': 'kellogg.com', 'mkc': 'mccormick.com',
    'mdlz': 'mondelez.com', 'nsrgy': 'nestle.com', 'danoy': 'danone.com', 'mo': 'altria.com',
    'pm': 'philipmorris.com', 'bti': 'britishamerican.com', 'imby': 'imperialbrands.com',
    'vgr': 'vector.com', 'uvv': 'universal.com', 'agco': 'agcocorp.com', 'cnhi': 'cnhindustrial.com',
    'lnn': 'lindsay.com', 'alg': 'alamo.com', 'rio': 'riotinto.com', 'bhp': 'bhpbilliton.com',
    'scco': 'southerncopper.com', 'teck': 'teck.com', 'hbm': 'hudbay.com', 'lun': 'lundin.com',
    'dow': 'dow.com', 'ce': 'celanese.com', 'fmc': 'fmccorp.com', 'alb': 'albemarle.com',
    'lthm': 'livent.com', 'sqm': 'sqm.com', 'lac': 'lithiumamericas.com', 'pll': 'piedmont.com',
    'pkg': 'packagingcorp.com', 'bll': 'ball.com', 'wrk': 'westrock.com', 'slgn': 'silgan.com',
    'son': 'sonoco.com', 'bery': 'berryglobal.com', 'ip': 'internationalpaper.com', 'wy': 'weyerhaeuser.com',
    'ufs': 'domtar.com', 'slvm': 'sylvamo.com', 'vmc': 'vulcanmaterials.com', 'mlm': 'martinmarietta.com',
    'sum': 'summitmaterials.com', 'uscr': 'usconcrete.com', 'trex': 'trex.com', 'lpx': 'louisianapacific.com',
    'ufpi': 'ufpi.com', 'matx': 'matson.com', 'gogl': 'golden.com', 'unp': 'up.com',
    'csx': 'csx.com', 'nsc': 'nscorp.com', 'cp': 'cp.ca', 'cni': 'cn.ca',
    'ksu': 'kansassouthern.com', 'awk': 'americanwater.com', 'awr': 'americanstates.com',
    'cwt': 'californianwater.com', 'sbs': 'sabesp.com', 'aes': 'aes.com', 'ceg': 'constellation.com',
    'enph': 'enphase.com', 'sedg': 'solaredge.com', 'run': 'sunrun.com', 'fslr': 'firstsolar.com',
    'arry': 'array.com', 'dk': 'delek.com', 'et': 'energytransfer.com', 'epd': 'enterpriseproducts.com',
    'kmi': 'kindermorgan.com', 'oke': 'oneok.com', 'wmb': 'williams.com', 'trgp': 'targaresources.com',
    'btu': 'peabody.com', 'arch': 'archcoal.com', 'hcc': 'warrior.com', 'plug': 'plugpower.com',
    'be': 'bloomenergy.com', 'blnk': 'blinkcharging.com', 'chpt': 'chargepoint.com', 'evgo': 'evgo.com',
    'gme': 'gamestop.com', 'uaa': 'underarmour.com', 'fnd': 'flooranddecor.com', 'an': 'autonation.com',
    'abg': 'asbury.com', 'lad': 'lithia.com', 'pag': 'penske.com', 'sah': 'sonic.com',
    'm': 'macys.com', 'kss': 'kohls.com', 'dds': 'dillards.com', 'jwn': 'nordstrom.com',
    'wba': 'walgreens.com', 'rad': 'riteaid.com', 'syy': 'sysco.com', 'usfd': 'usfoods.com',
    'pfgc': 'pfgc.com', 'kr': 'kroger.com', 'sfm': 'sprouts.com', 'wmk': 'weis.com',
    'lvs': 'lasvegassands.com', 'wynn': 'wynn.com', 'mgm': 'mgmresorts.com', 'czr': 'caesars.com',
    'byd': 'boydgaming.com', 'flut': 'flutter.com', 'fun': 'cedarfair.com', 'seas': 'seaworld.com',
    'six': 'sixflags.com', 'pii': 'polaris.com', 'hog': 'harley-davidson.com', 'bc': 'brunswick.com',
    'rl': 'ralphlauren.com', 'pvh': 'pvh.com', 'vfc': 'vfc.com', 'hbi': 'hanes.com',
    'clx': 'clorox.com', 'chd': 'churchdwight.com', 'enr': 'energizer.com', 'el': 'esteelauder.com',
    'cl': 'colgate.com', 'rev': 'revlon.com', 'vtr': 'ventas.com', 'peak': 'healthpeak.com',
    'ohi': 'omegahealthcare.com', 'hst': 'host.com', 'peb': 'pebblebrook.com', 'aple': 'apple.com',
    'rexr': 'rexford.com', 'bxp': 'bostonproperties.com', 'vno': 'vornado.com', 'slg': 'slgreen.com',
    'pdm': 'piedmont.com', 'eqr': 'equityresidential.com', 'avb': 'avalonbay.com', 'maa': 'maac.com',
    'udr': 'udr.com', 'cpt': 'camden.com', 'ess': 'essex.com', 'skt': 'tanger.com',
    'mac': 'macerich.com', 'reg': 'regcenters.com', 'cci': 'crowncastle.com', 'sbac': 'sba.com',
    'lsi': 'lsi.com', 'wafd': 'wafd.com', 'upst': 'upstart.com', 'mkl': 'markel.com',
    'trow': 'troweprice.com', 'ben': 'franklin.com', 'etfc': 'etrade.com', 'cme': 'cmegroup.com',
    'ice': 'theice.com', 'ndaq': 'nasdaq.com', 'agnc': 'agnc.com', 'nly': 'annaly.com',
    'two': 'twocapital.com', 'aon': 'aon.com', 'mmc': 'marsh.com', 'bro': 'brownandbrown.com',
    're': 'everest.com', 'ibm': 'ibm.com', 'acn': 'accenture.com', 'dxc': 'dxc.com',
    'fis': 'fisglobal.com', 'fisv': 'fiserv.com', 'gpn': 'globalpayments.com', 'flyw': 'flywire.com',
    'csco': 'cisco.com', 'nok': 'nokia.com', 'eric': 'ericsson.com', 'hpq': 'hp.com',
    'hpe': 'hpe.com', 'keys': 'keysight.com', 'flex': 'flex.com', 'jbl': 'jabil.com',
    'arw': 'arrow.com', 'tmus': 't-mobile.com', 'lite': 'lument.com', 'lbrdk': 'liberty.com',
    'nwsa': 'news.com', 'nws': 'news.com'
  };
  
  const domain = domainMap[symbol.toLowerCase()];
  if (domain) {
    // Clearbit Logo API - ingyenes és megbízható
    return `https://logo.clearbit.com/${domain}`;
  }
  
  // 3. Fallback: Yahoo Finance placeholder
  return `https://s.yimg.com/cv/apiv2/default/company_logos/${symbol.toLowerCase()}.svg`;
}

// Részvények lekérése közvetlenül a Yahoo Finance API-ból
router.get('/stocks', async (req, res) => {
  try {
    const { search } = req.query;
    
    // Alapból csak a TOP 10-et mutatjuk, keresés esetén az adott szöveggel kezdődőket
    let symbolsToFetch;
    if (search && search.trim()) {
      const searchUpper = search.trim().toUpperCase();
      // Keresés: azzal kezdődő részvények
      symbolsToFetch = STOCK_SYMBOLS.filter(symbol => 
        symbol.toUpperCase().startsWith(searchUpper)
      );
    } else {
      // Alapból csak a TOP 10
      symbolsToFetch = STOCK_SYMBOLS.slice(0, 10);
    }

    // Párhuzamos lekérés minden részvényhez (max 50 egyszerre a teljesítmény miatt)
    const batchSize = 50;
    const allStocks = [];
    
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);
      const quotes = await Promise.allSettled(
        batch.map(symbol => {
          try {
            return yahooFinance.quote(symbol);
          } catch (err) {
            console.error(`Hiba a ${symbol} lekérésekor:`, err.message);
            return Promise.reject(err);
          }
        })
      );

      quotes.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const quote = result.value;
          if (quote && quote.regularMarketPrice) {
            const symbol = batch[index];
            
            allStocks.push({
              symbol: symbol,
              name: quote.shortName || quote.longName || symbol,
              price: Number(quote.regularMarketPrice),
              change_percent: quote.regularMarketChangePercent !== undefined && quote.regularMarketChangePercent !== null
                ? Number(quote.regularMarketChangePercent)
                : 0,
              logo_url: getLogoUrl(symbol, quote)
            });
          }
        } else if (result.status === 'rejected') {
          console.warn(`Nem sikerült lekérni a ${batch[index]} részvényt:`, result.reason?.message || 'Ismeretlen hiba');
        }
      });
    }

    // Rendezés symbol szerint
    allStocks.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return res.json({ stocks: allStocks });
  } catch (err) {
    console.error('Részvények lekérési hiba:', err);
    return res.status(500).json({ message: 'Hiba a részvények lekérése során' });
  }
});

// Portfolio lekérése
router.get('/portfolio', auth(), async (req, res) => {
  try {
    const holdings = await query(
      `SELECT sh.*, sh.symbol, sh.name
       FROM stock_holdings sh
       WHERE sh.user_id = ?
       ORDER BY sh.symbol`,
      [req.user.id]
    );

    // Aktuális árak lekérése a Yahoo Finance API-ból
    const holdingsWithPrices = await Promise.all(
      holdings.map(async (holding) => {
        try {
          const quote = await yahooFinance.quote(holding.symbol);
          const currentPrice = quote.regularMarketPrice 
            ? Number(quote.regularMarketPrice) 
            : Number(holding.average_price);
          
          return {
            ...holding,
            current_price: currentPrice,
            logo_url: getLogoUrl(holding.symbol, quote)
          };
        } catch (err) {
          console.error(`Hiba a ${holding.symbol} árának lekérésekor:`, err.message);
          return {
            ...holding,
            current_price: Number(holding.average_price),
            logo_url: getLogoUrl(holding.symbol)
          };
        }
      })
    );

    return res.json({ holdings: holdingsWithPrices });
  } catch (err) {
    console.error('Portfolio lekérési hiba:', err);
    return res.status(500).json({ message: 'Hiba a portfolio lekérése során' });
  }
});

// Részvény vásárlás
router.post('/buy', auth(), async (req, res) => {
  const { symbol, quantity } = req.body;

  const numericQuantity = parseFloat(quantity);
  if (!symbol || !numericQuantity || numericQuantity <= 0 || isNaN(numericQuantity)) {
    return res.status(400).json({ message: 'Érvénytelen mennyiség vagy symbol' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Részvény adatok lekérése a Yahoo Finance API-ból
    let quote;
    try {
      // Ellenőrizzük, hogy a symbol a listában van-e
      const isValidSymbol = STOCK_SYMBOLS.includes(symbol);
      if (!isValidSymbol) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Érvénytelen részvény szimbólum' });
      }

      quote = await yahooFinance.quote(symbol);
    } catch (err) {
      console.error(`Yahoo Finance API hiba a ${symbol} lekérésekor:`, err.message);
      await connection.rollback();
      connection.release();
      return res.status(404).json({ 
        message: `Részvény nem található: ${err.message || 'Ismeretlen hiba'}` 
      });
    }

    if (!quote || !quote.regularMarketPrice) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Részvény ár nem elérhető' });
    }

    const stockPrice = Number(quote.regularMarketPrice);
    const stockName = quote.shortName || quote.longName || symbol;
    const totalCost = Math.round(stockPrice * numericQuantity * USD_TO_HUF);

    // Felhasználó egyenleg ellenőrzése
    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id]
    );

    const user = userRows[0];
    if (!user || Number(user.balance) < totalCost) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        message: `Nincs elegendő egyenleg. Szükséges: ${totalCost.toLocaleString('hu-HU')} HUF` 
      });
    }

    // Ellenőrizzük, hogy van-e már ilyen részvény a portfolióban
    let existingHoldings;
    try {
      [existingHoldings] = await connection.execute(
        'SELECT * FROM stock_holdings WHERE user_id = ? AND symbol = ? FOR UPDATE',
        [req.user.id, symbol]
      );
    } catch (dbErr) {
      console.error('Adatbázis hiba a holdings lekérésekor:', dbErr);
      await connection.rollback();
      connection.release();
      return res.status(500).json({ 
        message: 'Adatbázis hiba',
        error: process.env.NODE_ENV === 'development' ? dbErr.message : undefined
      });
    }

    if (existingHoldings.length > 0) {
      // Frissítjük a meglévő pozíciót
      const existing = existingHoldings[0];
      const newQuantity = Number(existing.quantity) + numericQuantity;
      const existingInvestedUSD = Number(existing.total_invested) / USD_TO_HUF;
      const newInvestedUSD = numericQuantity * stockPrice;
      const totalInvestedUSD = existingInvestedUSD + newInvestedUSD;
      const newAveragePrice = totalInvestedUSD / newQuantity;
      const newTotalInvested = Math.round(totalInvestedUSD * USD_TO_HUF);

      try {
        await connection.execute(
          `UPDATE stock_holdings 
           SET quantity = ?, average_price = ?, total_invested = ?, name = ?
           WHERE user_id = ? AND symbol = ?`,
          [newQuantity, newAveragePrice, newTotalInvested, stockName, req.user.id, symbol]
        );
      } catch (updateErr) {
        console.error('Update hiba:', updateErr);
        throw updateErr;
      }
    } else {
      // Új pozíció létrehozása
      try {
        await connection.execute(
          `INSERT INTO stock_holdings (user_id, symbol, name, quantity, average_price, total_invested)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.user.id, symbol, stockName, numericQuantity, stockPrice, totalCost]
        );
      } catch (insertErr) {
        console.error('Insert hiba:', insertErr);
        console.error('Insert részletek:', {
          user_id: req.user.id,
          symbol,
          name: stockName,
          quantity: numericQuantity,
          average_price: stockPrice,
          total_invested: totalCost
        });
        throw insertErr;
      }
    }

    // Egyenleg levonása
    await connection.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [totalCost, req.user.id]
    );

    // Új egyenleg lekérése
    const [updatedUser] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id]
    );

    await connection.commit();
    connection.release();

    return res.json({
      message: 'Részvény sikeresen megvásárolva',
      newBalance: Number(updatedUser[0].balance),
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback hiba:', rollbackErr);
      }
      try {
        connection.release();
      } catch (releaseErr) {
        console.error('Release hiba:', releaseErr);
      }
    }
    console.error('Tranzakció hiba:', err);
    console.error('Hiba részletek:', {
      message: err.message,
      stack: err.stack,
      symbol: req.body?.symbol,
      quantity: req.body?.quantity
    });
    return res.status(500).json({ 
      message: 'Hiba a tranzakció során',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        symbol: req.body?.symbol,
        quantity: req.body?.quantity,
        stack: err.stack
      } : undefined
    });
  }
});

// Részvény eladás
router.post('/sell', auth(), async (req, res) => {
  const { symbol, quantity } = req.body;

  const numericQuantity = parseFloat(quantity);
  if (!symbol || !numericQuantity || numericQuantity <= 0 || isNaN(numericQuantity)) {
    return res.status(400).json({ message: 'Érvénytelen mennyiség vagy symbol' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Részvény adatok lekérése a Yahoo Finance API-ból (jelenlegi ár)
    let quote;
    try {
      quote = await yahooFinance.quote(symbol);
    } catch (err) {
      console.error(`Yahoo Finance API hiba a ${symbol} lekérésekor:`, err.message);
      await connection.rollback();
      connection.release();
      return res.status(404).json({ 
        message: `Részvény nem található: ${err.message || 'Ismeretlen hiba'}` 
      });
    }

    if (!quote || !quote.regularMarketPrice) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Részvény ár nem elérhető' });
    }

    const currentPrice = Number(quote.regularMarketPrice);
    const totalRevenue = Math.round(currentPrice * numericQuantity * USD_TO_HUF);

    // Ellenőrizzük, hogy van-e ilyen részvény a portfolióban
    const [existingHoldings] = await connection.execute(
      'SELECT * FROM stock_holdings WHERE user_id = ? AND symbol = ? FOR UPDATE',
      [req.user.id, symbol]
    );

    if (existingHoldings.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Nincs ilyen részvényed a portfolióban' });
    }

    const holding = existingHoldings[0];
    const currentQuantity = Number(holding.quantity);

    if (numericQuantity > currentQuantity) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        message: `Nincs elegendő részvényed. Rendelkezésre álló: ${currentQuantity}` 
      });
    }

    // Új mennyiség számítása
    const newQuantity = currentQuantity - numericQuantity;

    if (newQuantity <= 0) {
      // Teljes eladás - töröljük a pozíciót
      await connection.execute(
        'DELETE FROM stock_holdings WHERE user_id = ? AND symbol = ?',
        [req.user.id, symbol]
      );
    } else {
      // Részleges eladás - frissítjük a pozíciót
      // Az average_price és total_invested arányosan csökken
      const sellRatio = numericQuantity / currentQuantity;
      const newTotalInvested = Math.round(Number(holding.total_invested) * (1 - sellRatio));
      
      await connection.execute(
        `UPDATE stock_holdings 
         SET quantity = ?, total_invested = ?
         WHERE user_id = ? AND symbol = ?`,
        [newQuantity, newTotalInvested, req.user.id, symbol]
      );
    }

    // Egyenleg növelése
    await connection.execute(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [totalRevenue, req.user.id]
    );

    // Új egyenleg lekérése
    const [updatedUser] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id]
    );

    await connection.commit();
    connection.release();

    return res.json({
      message: 'Részvény sikeresen eladva',
      newBalance: Number(updatedUser[0].balance),
      revenue: totalRevenue
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback hiba:', rollbackErr);
      }
      try {
        connection.release();
      } catch (releaseErr) {
        console.error('Release hiba:', releaseErr);
      }
    }
    console.error('Eladási tranzakció hiba:', err);
    return res.status(500).json({ 
      message: 'Hiba az eladás során',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;

