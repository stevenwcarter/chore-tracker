import { User } from 'types/chore';

export const UserImage = ({ user }: { user: User }) => (
  <div className="w-20 h-20 rounded-full overflow-hidden bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center">
    {user.imagePath ? (
      <img src={user.imagePath} alt={user.name} className="w-full h-full object-cover" />
    ) : (
      <span className="text-white text-2xl font-bold">{user.name.charAt(0).toUpperCase()}</span>
    )}
  </div>
);

export default UserImage;
