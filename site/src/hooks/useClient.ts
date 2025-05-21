import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Client } from 'types';
import { DELETE_CLIENT_GQL, GET_CLIENT_GQL, UPDATE_CLIENT_GQL } from './queries';

interface GetClientResponse {
  getClient: Client;
}

export const useClient = (clientUuid?: string) => {
  const apolloClient = useApolloClient();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [updateClientMutation] = useMutation(UPDATE_CLIENT_GQL, {
    refetchQueries: [GET_CLIENT_GQL],
  });
  const [deleteClientMutation] = useMutation(DELETE_CLIENT_GQL, {
    refetchQueries: [GET_CLIENT_GQL],
  });
  const { data } = useQuery<GetClientResponse>(GET_CLIENT_GQL, {
    variables: { clientUuid },
    skip: !clientUuid || clientUuid.trim() === '',
  });

  useEffect(() => {
    if (data && data.getClient) {
      setClient(data.getClient);
    }
  }, [data]);

  const updateClient = async (updatedClient: Partial<Client>) => {
    if (!client) {
      console.error('Client not found');
      return;
    }
    delete updatedClient.createdAt;
    delete updatedClient.updatedAt;
    try {
      setClient({ ...client, ...updatedClient });
      await updateClientMutation({
        variables: { client: updatedClient },
      });
      apolloClient.cache.evict({ fieldName: 'listClients' });
    } catch (error) {
      console.error('Error creating client:', error);
    }
  };

  const deleteClient = async (clientUuidToDelete: string) => {
    try {
      await deleteClientMutation({
        variables: { clientUuid: clientUuidToDelete },
      });
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  return { client, updateClient, deleteClient };
};
