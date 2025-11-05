from coingecko import CoinGecko

cg = CoinGecko()
def get_coins_value():
  val = cg.get_simple_price(ids=["bitcoin",
        "ethereum",
        "tether",
        "solana",
        "tron",
        "dogecoin",
        "binancecoin",
        "lisk",], vs_currencies=["usd"], include_24hr_change=True, include_24hr_vol=True, include_last_updated_at= True, include_market_cap=True)
  # item = cg.get_coin_ohlc(id='bitcoin', days=7, vs_currency='usd')
  return val

def get_market_data_days(id:str, days:int, vs_currency:str):
  val = cg.get_coin_ohlc(id=id, days=days, vs_currency=vs_currency)
  return val