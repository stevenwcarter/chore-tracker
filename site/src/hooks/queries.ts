import { gql } from '@apollo/client';

export const LIST_BALANCES_GQL = gql`
  query getBalances {
    getBalances {
      name
      balance
    }
  }
`;

export const GET_PENDING_TOTALS = gql`
  query GetPendingTotals {
    getPendingTotals {
      amountCents
      user {
        id
      }
    }
  }
`;
