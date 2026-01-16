# Disk configuration for Hetzner Cloud VM
# Uses GPT with BIOS boot partition (for legacy boot) and ext4 root
{
  disko.devices = {
    disk = {
      main = {
        type = "disk";
        device = "/dev/sda";
        content = {
          type = "gpt";
          partitions = {
            # BIOS boot partition for GRUB
            boot = {
              size = "1M";
              type = "EF02";
              priority = 1;
            };
            # EFI System Partition (for future UEFI support)
            ESP = {
              size = "512M";
              type = "EF00";
              content = {
                type = "filesystem";
                format = "vfat";
                mountpoint = "/boot";
              };
            };
            # Root filesystem
            root = {
              size = "100%";
              content = {
                type = "filesystem";
                format = "ext4";
                mountpoint = "/";
              };
            };
          };
        };
      };
    };
  };
}
