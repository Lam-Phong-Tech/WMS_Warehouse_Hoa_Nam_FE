import { useQuery } from '@tanstack/react-query';
import { usersService } from '@/modules/users/services/users.service';
import { usersKeys } from '@/modules/users/services/users.keys';

/** Danh sách người dùng. */
export function useUsers() {
  return useQuery({
    queryKey: usersKeys.lists(),
    queryFn: () => usersService.list(),
  });
}
