import { User } from 'types/chore';

/** Avatar sizes. `lg` (80px) is the default so every pre-existing call site -
 *  UserSelector, UserManagementCard - renders exactly as before. */
const SIZE_CLASSES = {
  sm: { box: 'w-12 h-12', initial: 'text-lg' },
  lg: { box: 'w-20 h-20', initial: 'text-2xl' },
} as const;

interface UserImageProps {
  user: User;
  size?: keyof typeof SIZE_CLASSES;
}

export const UserImage = ({ user, size = 'lg' }: UserImageProps) => {
  const { box, initial } = SIZE_CLASSES[size];

  return (
    <div
      className={`cursor-pointer ${box} rounded-full overflow-hidden bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center`}
    >
      {user.imagePath ? (
        <img src={user.imagePath} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <span className={`text-white ${initial} font-bold`}>
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

export default UserImage;
