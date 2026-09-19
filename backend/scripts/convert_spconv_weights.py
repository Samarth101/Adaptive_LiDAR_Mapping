import torch
import sys

def convert_spconv1_to_spconv2(input_path, output_path):
    print(f"Loading {input_path}...")
    checkpoint = torch.load(input_path, map_location='cpu')
    
    if 'state_dict' in checkpoint:
        state_dict = checkpoint['state_dict']
    elif 'model_state' in checkpoint:
        state_dict = checkpoint['model_state']
    else:
        state_dict = checkpoint
        
    new_state_dict = {}
    for k, v in state_dict.items():
        # Spconv v1 3D conv weights are [D, H, W, in_channels, out_channels]
        # Spconv v2 3D conv weights are [out_channels, D, H, W, in_channels]
        if v.dim() == 5:
            # Check if this is a spconv weight by checking shape
            # We assume dim 4 is out_channels, and we need to move it to dim 0
            v_new = v.permute(4, 0, 1, 2, 3).contiguous()
            new_state_dict[k] = v_new
            print(f"Permuted {k}: {v.shape} -> {v_new.shape}")
        else:
            new_state_dict[k] = v
            
    # We also need to rename keys if there's any mismatch, but the error logs
    # only showed "size mismatch", meaning the keys are identical!
    
    # Let's save the new checkpoint
    new_checkpoint = {'model_state': new_state_dict}
    torch.save(new_checkpoint, output_path)
    print(f"Saved converted checkpoint to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert.py <in.pt> <out.pt>")
        sys.exit(1)
    convert_spconv1_to_spconv2(sys.argv[1], sys.argv[2])
