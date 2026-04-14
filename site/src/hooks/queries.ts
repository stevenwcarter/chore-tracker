import { gql } from '@apollo/client';

export const LIST_BALANCES_GQL = gql`
  query getBalances {
    getBalances {
      name
      balance
    }
  }
`;
