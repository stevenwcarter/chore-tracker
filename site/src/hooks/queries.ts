import { gql } from '@apollo/client';

// Clients
export const LIST_CLIENTS_GQL = gql`
  query listClients($limit: Int, $offset: Int) {
    listClients(limit: $limit, offset: $offset) {
      uuid
      name
      description
      archived
      createdAt
      updatedAt
    }
  }
`;
export const CREATE_CLIENT_GQL = gql`
  mutation CreateClient($client: ClientInput!) {
    createClient(client: $client) {
      uuid
    }
  }
`;
export const DELETE_CLIENT_GQL = gql`
  mutation DeleteClient($clientUuid: String!) {
    deleteClient(clientUuid: $clientUuid)
  }
`;
export const UPDATE_CLIENT_GQL = gql`
  mutation UpdateClient($client: ClientInput!) {
    updateClient(client: $client) {
      uuid
    }
  }
`;
export const GET_CLIENT_GQL = gql`
  query GetClient($clientUuid: String!) {
    getClient(clientUuid: $clientUuid) {
      uuid
      name
      description
      archived
      createdAt
      updatedAt
    }
  }
`;

// Estimates
export const LIST_ESTIMATES_GQL = gql`
  query listEstimates($clientUuid: String, $limit: Int, $offset: Int) {
    listEstimates(clientUuid: $clientUuid, limit: $limit, offset: $offset) {
      uuid
      name
      clientUuid
      description
      status
      archived
      createdAt
      updatedAt
    }
  }
`;
export const CREATE_ESTIMATE_GQL = gql`
  mutation CreateEstimate($estimate: EstimateInput!) {
    createEstimate(estimate: $estimate) {
      uuid
    }
  }
`;
export const DELETE_ESTIMATE_GQL = gql`
  mutation DeleteEstimate($estimateUuid: String!) {
    deleteEstimate(estimateUuid: $estimateUuid)
  }
`;
export const UPDATE_ESTIMATE_GQL = gql`
  mutation UpdateEstimate($estimate: EstimateInput!) {
    updateEstimate(estimate: $estimate) {
      uuid
    }
  }
`;
export const GET_ESTIMATE_GQL = gql`
  query GetEstimate($estimateUuid: String!) {
    getEstimate(estimateUuid: $estimateUuid) {
      uuid
      clientUuid
      name
      status
      description
      archived
      createdAt
      updatedAt
      client {
        uuid
        name
        description
      }
    }
  }
`;

// Approaches
export const LIST_APPROACHES_GQL = gql`
  query listApproaches($estimateUuid: String, $limit: Int, $offset: Int) {
    listApproaches(estimateUuid: $estimateUuid, limit: $limit, offset: $offset) {
      uuid
      estimateUuid
      name
      description
      createdAt
      updatedAt
      totalHours {
        beLow
        beHigh
        feLow
        feHigh
      }
    }
  }
`;
export const CREATE_APPROACH_GQL = gql`
  mutation CreateApproach($approach: ApproachInput!) {
    createApproach(approach: $approach) {
      uuid
    }
  }
`;
export const DELETE_APPROACH_GQL = gql`
  mutation DeleteApproach($approachUuid: String!) {
    deleteApproach(approachUuid: $approachUuid)
  }
`;
export const UPDATE_APPROACH_GQL = gql`
  mutation UpdateApproach($approach: ApproachInput!) {
    updateApproach(approach: $approach) {
      uuid
    }
  }
`;
export const GET_APPROACH_GQL = gql`
  query GetApproach($approachUuid: String!) {
    getApproach(approachUuid: $approachUuid) {
      uuid
      estimateUuid
      name
      description
      createdAt
      updatedAt
      client {
        uuid
        name
        description
      }
      estimate {
        uuid
        name
        description
      }
      totalsByFeature {
        feature
        beLow
        beHigh
        feLow
        feHigh
      }
      totalHours {
        beLow
        beHigh
        feLow
        feHigh
      }
    }
  }
`;
export const DUPLICATE_APPROACH_GQL = gql`
  mutation DuplicateApproach($approachUuid: String!) {
    duplicateApproach(approachUuid: $approachUuid) {
      uuid
    }
  }
`;

// Sections
export const LIST_SECTIONS_GQL = gql`
  query listSections($approachUuid: String, $limit: Int, $offset: Int) {
    listSections(approachUuid: $approachUuid, limit: $limit, offset: $offset) {
      uuid
      approachUuid
      name
      description
      createdAt
      updatedAt
      totals {
        beLow
        beHigh
        feLow
        feHigh
      }
    }
  }
`;
export const CREATE_SECTION_GQL = gql`
  mutation CreateSection($section: SectionInput!) {
    createSection(section: $section) {
      uuid
    }
  }
`;
export const DELETE_SECTION_GQL = gql`
  mutation DeleteSection($sectionUuid: String!) {
    deleteSection(sectionUuid: $sectionUuid)
  }
`;
export const UPDATE_SECTION_GQL = gql`
  mutation UpdateSection($section: SectionInput!) {
    updateSection(section: $section) {
      uuid
    }
  }
`;
export const GET_SECTION_GQL = gql`
  query GetSection($sectionUuid: String!) {
    getSection(sectionUuid: $sectionUuid) {
      uuid
      approachUuid
      name
      description
      createdAt
      updatedAt
      totals
    }
  }
`;

// LineItems
export const LIST_LINE_ITEMS_GQL = gql`
  query listLineItems($sectionUuid: String, $limit: Int, $offset: Int) {
    listLineItems(sectionUuid: $sectionUuid, limit: $limit, offset: $offset) {
      uuid
      sectionUuid
      task
      notes
      feature
      beLow
      beHigh
      feLow
      feHigh
      quantity
      createdAt
      updatedAt
    }
  }
`;
export const CREATE_LINE_ITEM_GQL = gql`
  mutation CreateLineItem($lineItem: LineItemInput!) {
    createLineItem(lineItem: $lineItem) {
      uuid
    }
  }
`;
export const DELETE_LINE_ITEM_GQL = gql`
  mutation DeleteLineItem($lineItemUuid: String!) {
    deleteLineItem(lineItemUuid: $lineItemUuid)
  }
`;
export const UPDATE_LINE_ITEM_GQL = gql`
  mutation UpdateLineItem($lineItem: LineItemInput!) {
    updateLineItem(lineItem: $lineItem) {
      uuid
    }
  }
`;
export const GET_LINE_ITEM_GQL = gql`
  query GetLineItem($lineItemUuid: String!) {
    getLineItem(uuid: $lineItemUuid) {
      uuid
      sectionUuid
      task
      notes
      feature
      beLow
      beHigh
      feLow
      feHigh
      quantity
      createdAt
      updatedAt
    }
  }
`;
