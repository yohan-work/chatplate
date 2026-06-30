interface AvatarProps {
  name: string;
  src?: string;
}

export function Avatar({ name, src }: AvatarProps) {
  if (src) {
    return <img className="avatar" src={src} alt={`${name} 아바타`} />;
  }

  return (
    <span className="avatar avatar--initial" aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
