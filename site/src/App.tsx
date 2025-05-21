import LoadingSpinner from 'components/LoadingSpinner';
import React, { Suspense } from 'react';
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import { ToastContainer } from 'react-toastify';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';

const PageTemplate = React.lazy(() => import('page/PageTemplate'));
const HomePage = React.lazy(() => import('page/HomePage'));
const AdminChoreManagementPage = React.lazy(() => import('page/AdminChoreManagementPage'));
const AdminCompletionReviewPage = React.lazy(() => import('page/AdminCompletionReviewPage'));
const AdminPayoutSystemPage = React.lazy(() => import('page/AdminPayoutSystemPage'));

const apolloClient = new ApolloClient({
  cache: new InMemoryCache({ addTypename: false }),
  uri: '/graphql',
});

const App: React.FC = () => {
  const router = createBrowserRouter([
    {
      path: '/',
      element: <PageTemplate />,
      children: [
        {
          index: true,
          element: <HomePage />,
        },
        {
          path: 'admin',
          children: [
            {
              path: 'chores',
              element: <AdminChoreManagementPage />,
            },
            {
              path: 'reviews',
              element: <AdminCompletionReviewPage />,
            },
            {
              path: 'payouts',
              element: <AdminPayoutSystemPage />,
            },
          ],
        },
      ],
    },
  ]);

  return (
    <React.StrictMode>
      <ApolloProvider client={apolloClient}>
        <Suspense fallback={<LoadingSpinner />}>
          <ToastContainer />
          <RouterProvider router={router} />
        </Suspense>
      </ApolloProvider>
    </React.StrictMode>
  );
};

export default App;
