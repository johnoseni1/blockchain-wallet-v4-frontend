import { lift, mapObjIndexed, values } from 'ramda'

import {
  AccountTokensBalancesResponseType,
  BSPaymentTypes,
  CoinfigType,
  ExtractSuccess,
  SwapOrderType,
  WalletFiatEnum
} from '@core/types'
import { selectors } from 'data'
import { RootState } from 'data/rootReducer'
import { UserDataType } from 'data/types'

import { getOutputFromPair } from '../swap/model'

// eslint-disable-next-line import/prefer-default-export
export const getCoinsWithBalanceOrMethod = (state: RootState) => {
  const sbMethodsR = selectors.components.buySell.getBSPaymentMethods(state)
  // TODO: SELF_CUSTODY, remove this
  const stxEligibility = selectors.coins.getStxSelfCustodyAvailablity(state)
  // TODO, check all custodial features
  const sbBalancesR = selectors.components.buySell.getBSBalances(state)
  const erc20sR = selectors.core.data.eth.getErc20AccountTokenBalances(state)
  const recentSwapTxs = selectors.custodial.getRecentSwapTxs(state).getOrElse([] as SwapOrderType[])
  const custodials = selectors.core.data.coins.getCustodialCoins()
  // TODO: Move this code to another place to clean this file
  const bindIntegrationArEnabled = selectors.core.walletOptions
    .getBindIntegrationArEnabled(state)
    .getOrElse(false) as boolean
  const userData = selectors.modules.profile.getUserData(state).getOrElse({} as UserDataType)
  const userCountryCode = userData?.address?.country || 'default'
  const allFiatCurrencies = Object.keys(WalletFiatEnum).filter(
    (value) =>
      typeof WalletFiatEnum[value] === 'number' && WalletFiatEnum[value] !== WalletFiatEnum.ARS
  )
  const countryCurrencies = {
    AR: bindIntegrationArEnabled ? [WalletFiatEnum[WalletFiatEnum.ARS]] : allFiatCurrencies,
    default: allFiatCurrencies
  }
  const fiatCurrencies = countryCurrencies[userCountryCode] || countryCurrencies.default
  // TODO: SELF_CUSTODY
  const selfCustodials = stxEligibility ? ['STX'] : []

  const transform = (
    paymentMethods: ExtractSuccess<typeof sbMethodsR>,
    sbBalances: ExtractSuccess<typeof sbBalancesR>,
    erc20s: AccountTokensBalancesResponseType['tokenAccounts']
  ) => {
    const custodialErc20s = Object.keys(sbBalances).filter(
      (coin) => window.coins[coin] && window.coins[coin].coinfig.type.erc20Address
    )
    const coinsInRecentSwaps = recentSwapTxs.map((tx) => getOutputFromPair(tx.pair))
    const coinOrder = [
      ...new Set([
        ...fiatCurrencies,
        'BTC',
        'ETH',
        'BCH',
        'XLM',
        ...selfCustodials,
        ...custodials,
        ...(erc20s
          .map(({ tokenHash }) => {
            return Object.keys(window.coins)
              .find(
                (coin) =>
                  window.coins[coin].coinfig.type?.erc20Address?.toLowerCase() ===
                  tokenHash.toLowerCase()
              )
              ?.toUpperCase()
          })
          .filter(Boolean) as string[]),
        ...custodialErc20s,
        ...coinsInRecentSwaps
      ])
    ]
      .filter(Boolean)
      .map((coin) => window.coins[coin])

    return values(
      mapObjIndexed((coin: { coinfig: CoinfigType }) => {
        return {
          ...coin,
          method:
            coin.coinfig.type.name !== 'FIAT' ||
            !!paymentMethods.methods.find(
              (method) =>
                method.currency === coin.coinfig.symbol && method.type === BSPaymentTypes.FUNDS
            )
        }
      }, coinOrder)
    )
  }

  return lift(transform)(sbMethodsR, sbBalancesR, erc20sR)
}

export default getCoinsWithBalanceOrMethod
