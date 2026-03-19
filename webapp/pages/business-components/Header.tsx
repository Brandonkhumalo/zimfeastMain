interface HeaderProps {
  name?: string;
}

export default function Header({ name }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-12">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold mb-4">ZimFeast Business Hub</h1>
        <p className="text-xl opacity-90 mb-2">
          Join Zimbabwe's fastest-growing food delivery platform
        </p>
        <p className="text-lg opacity-80">
          Welcome, {name}! Ready to grow your business with us?
        </p>
      </div>
    </header>
  );
}
